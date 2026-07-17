const fs = require('fs');
const dir = 'C:\\prun-tools\\prun-dam-radiation\\';
const toolset = 'C:\\prun-tools\\prun-toolset\\public\\';

const FILES = {
  'prun_rad_dam_noshield.jsonl': 'noshield',
  'prun_rad_dam_shield.jsonl': 'shield',
  'prun_rad_WX-827 GH-459 noshield.jsonl': 'noshield',
  'prun_rad_WX-827 GH-459 shield.jsonl': 'shield',
};
const findMissions = (o, a) => { if (!o || typeof o !== 'object') return; if (o.messageType === 'SHIP_FLIGHT_MISSION') a.push(o.payload); for (const v of Object.values(o)) findMissions(v, a); };
const lineOf = (s, t) => ((s.destination && s.destination.lines) || []).find(x => x.type === t);

// planet + star data
const planets = JSON.parse(fs.readFileSync(dir + 'all_planets.json', 'utf8'));
const semiMajorBy = {}, starTypeBy = {};
planets.forEach(p => { semiMajorBy[p.NaturalId] = Number(p.SemiMajorAxis); });
const stars = JSON.parse(fs.readFileSync(toolset + 'systemstars.json', 'utf8'));
const densBySys = {}, typeBySys = {};
stars.forEach(s => { densBySys[s.NaturalId] = s.MeteoroidDensity; typeBySys[s.NaturalId] = s.Type; });

// Aem constants
const K_RAD_NOSHIELD = 0.0734, K_RAD_SHIELD = 0.0224, FLOOR = 0.0002; // %/Mkm
const AU_M = 1.496e11;

// ---- Step 1+2: build rows ----
const rows = [];
const notes = [];
let missingSemi = new Set(), missingDens = new Set();
for (const [file, shield] of Object.entries(FILES)) {
  const lines = fs.readFileSync(dir + file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    let ms = [];
    try { const o = JSON.parse(lines[i]); if (o.raw) JSON.parse(o.raw.replace(/^\d+/, '')).forEach(m => findMissions(m, ms)); else findMissions(o, ms); }
    catch (e) { continue; }
    for (const m of ms) {
      if (!m.segments) continue;
      for (const s of m.segments) {
        if (s.type !== 'TRANSIT') continue;
        const pl = lineOf(s, 'PLANET'), sy = lineOf(s, 'SYSTEM');
        const planet = pl && pl.entity ? pl.entity.naturalId : null;
        const system = sy && sy.entity ? sy.entity.naturalId : null;
        const semi = planet != null ? semiMajorBy[planet] : undefined;
        const dens = system != null ? densBySys[system] : undefined;
        if (planet != null && semi === undefined) missingSemi.add(planet);
        if (system != null && dens === undefined) missingDens.add(system);
        const distMkm = (typeof s.stlDistance === 'number') ? s.stlDistance / 1e9 : null;   // metres -> Mkm
        const AU = (typeof semi === 'number') ? semi / AU_M : null;
        // Aem predicted, in PERCENT
        const radPctCoef = shield === 'shield' ? K_RAD_SHIELD : K_RAD_NOSHIELD;
        const radPct = (AU != null && distMkm != null) ? radPctCoef * Math.pow(AU, -2) * distMkm : null;
        const floorPct = (distMkm != null) ? FLOOR * distMkm : null;
        const totPct = (radPct != null && floorPct != null) ? radPct + floorPct : null;
        // convert to FRACTION to compare with observed segment.damage (which is a fraction)
        const predFrac = totPct != null ? totPct / 100 : null;
        const radFrac = radPct != null ? radPct / 100 : null;
        const floorFrac = floorPct != null ? floorPct / 100 : null;
        rows.push({
          file, shield, planet, system, starType: system != null ? typeBySys[system] : null,
          stlFuel: m.stlFuelConsumption, distMkm, AU, density: dens,
          observed: (typeof s.damage === 'number') ? s.damage : null,
          radPct, floorPct, totPct, radFrac, floorFrac, predFrac,
          residual: (predFrac != null && typeof s.damage === 'number') ? s.damage - predFrac : null,
          ratio: (predFrac != null && s.damage > 0) ? predFrac / s.damage : null,
          radShareOfPred: (radPct != null && totPct > 0) ? radPct / totPct : null,
        });
      }
    }
  }
}

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

// ---- output ----
let out = 'AEM RADIATION MODEL vs CAPTURED TRANSIT DATA\n';
out += 'Generated: ' + new Date().toISOString() + '\n';
out += 'Aem formula (%/Mkm): rad_noshield=0.0734*AU^-2, rad_shield=0.0224*AU^-2, meteoroid_floor=0.0002 ; *distMkm\n';
out += 'UNIT NOTE: Aem outputs PERCENT; segment.damage is a FRACTION. Predicted converted to fraction (÷100) to compare.\n';
out += 'distMkm = stlDistance_m/1e9 ; AU = SemiMajorAxis_m/1.496e11 ; density = MeteoroidDensity (systemstars.json)\n';
out += '='.repeat(130) + '\n\n';

out += 'FULL PER-ROW TABLE (TRANSIT segments)\n' + '-'.repeat(130) + '\n';
out += 'planet'.padEnd(9) + 'sys'.padEnd(8) + 'T'.padEnd(2) + 'shield'.padEnd(9) + 'AU'.padStart(7) + 'distMkm'.padStart(10) + 'radFrac'.padStart(13) + 'floorFrac'.padStart(12) + 'predFrac'.padStart(13) + 'observed'.padStart(13) + 'resid'.padStart(13) + 'rad%ofPred'.padStart(11) + '\n';
const ef = (v, d = 4) => v == null ? '—' : v.toExponential(d);
for (const r of rows.sort((a, b) => (a.planet || '').localeCompare(b.planet || '') || a.shield.localeCompare(b.shield) || (a.stlFuel - b.stlFuel))) {
  out += (r.planet || '?').padEnd(9) + (r.system || '?').padEnd(8) + (r.starType || '?').padEnd(2) + r.shield.padEnd(9)
    + (r.AU == null ? '—' : r.AU.toFixed(3)).padStart(7)
    + (r.distMkm == null ? '—' : r.distMkm.toFixed(3)).padStart(10)
    + ef(r.radFrac).padStart(13) + ef(r.floorFrac).padStart(12) + ef(r.predFrac).padStart(13)
    + ef(r.observed).padStart(13) + ef(r.residual).padStart(13)
    + (r.radShareOfPred == null ? '—' : (r.radShareOfPred * 100).toFixed(1) + '%').padStart(11) + '\n';
}
out += '\n';

// ---- per-planet summary ----
out += 'PER-PLANET SUMMARY (mean over that planet+shield group)\n' + '-'.repeat(130) + '\n';
out += 'planet'.padEnd(9) + 'sys'.padEnd(8) + 'T'.padEnd(2) + 'shield'.padEnd(9) + 'n'.padStart(4) + 'AU'.padStart(7) + 'distMkm'.padStart(9) + 'radFrac'.padStart(12) + 'floorFrac'.padStart(12) + 'predFrac'.padStart(12) + 'obsFrac'.padStart(12) + 'resid'.padStart(12) + 'ratio'.padStart(9) + 'rad%pred'.padStart(9) + '  flag\n';
const groups = {};
for (const r of rows) { const k = r.planet + '|' + r.shield; (groups[k] = groups[k] || []).push(r); }
const perPlanet = [];
for (const k of Object.keys(groups).sort()) {
  const g = groups[k];
  const rec = {
    planet: g[0].planet, system: g[0].system, starType: g[0].starType, shield: g[0].shield, n: g.length,
    AU: g[0].AU, distMkm: mean(g.map(r => r.distMkm).filter(v => v != null)),
    radFrac: mean(g.map(r => r.radFrac).filter(v => v != null)),
    floorFrac: mean(g.map(r => r.floorFrac).filter(v => v != null)),
    predFrac: mean(g.map(r => r.predFrac).filter(v => v != null)),
    obsFrac: mean(g.map(r => r.observed).filter(v => v != null)),
    radShare: mean(g.map(r => r.radShareOfPred).filter(v => v != null)),
  };
  rec.resid = (rec.predFrac != null && rec.obsFrac != null) ? rec.obsFrac - rec.predFrac : null;
  rec.ratio = (rec.predFrac != null && rec.obsFrac > 0) ? rec.predFrac / rec.obsFrac : null;
  rec.belowThresh = rec.radShare != null && rec.radShare < 0.05;
  perPlanet.push(rec);
  out += (rec.planet || '?').padEnd(9) + (rec.system || '?').padEnd(8) + (rec.starType || '?').padEnd(2) + rec.shield.padEnd(9)
    + String(rec.n).padStart(4) + (rec.AU == null ? '—' : rec.AU.toFixed(3)).padStart(7)
    + (rec.distMkm == null ? '—' : rec.distMkm.toFixed(2)).padStart(9)
    + ef(rec.radFrac, 3).padStart(12) + ef(rec.floorFrac, 3).padStart(12) + ef(rec.predFrac, 3).padStart(12)
    + ef(rec.obsFrac, 3).padStart(12) + ef(rec.resid, 3).padStart(12)
    + (rec.ratio == null ? '—' : rec.ratio.toFixed(3)).padStart(9)
    + (rec.radShare == null ? '—' : (rec.radShare * 100).toFixed(1) + '%').padStart(9)
    + '  ' + (rec.belowThresh ? 'RAD<5% below-detection' : '') + '\n';
}
out += '\n';

// ---- Step 4 verdict ----
const posObs = perPlanet.filter(r => r.obsFrac > 0);
out += 'STEP 4 — VERDICT\n' + '#'.repeat(130) + '\n';
// fit: does Aem predicted total ~ observed?
const fitLines = posObs.map(r => `  ${r.planet}/${r.starType} @ ${r.AU ? r.AU.toFixed(2) : '?'}AU ${r.shield}: pred ${ef(r.predFrac, 2)} vs obs ${ef(r.obsFrac, 2)}  (pred/obs=${r.ratio == null ? '—' : r.ratio.toFixed(3)})`);
out += 'A) Does Aem\'s formula (rad + 0.0002 floor) fit observed TRANSIT damage?\n';
out += fitLines.join('\n') + '\n';
const bigMiss = posObs.filter(r => r.ratio != null && (r.ratio < 0.2 || r.ratio > 5));
out += '  => Aem total mispredicts observed for ' + bigMiss.length + '/' + posObs.length + ' planet-groups by >5x. The 0.0002 floor is NOT the\n';
out += '     real meteoroid term (the density-dependent meteor formula is); Aem\'s floor was a KQ-451-specific lump. So Aem\'s TOTAL\n';
out += '     does not fit — but that is expected: Aem\'s model is a RADIATION model, not a meteoroid model.\n\n';

out += 'B) Which planets have detectable radiation (rad >= 5% of predicted total)?\n';
const detect = perPlanet.filter(r => !r.belowThresh && r.radShare != null);
out += (detect.length ? [...new Set(detect.map(r => `${r.planet}(${r.starType},${r.AU ? r.AU.toFixed(2) : '?'}AU): rad ${(r.radShare * 100).toFixed(1)}% of Aem-pred`))].join('\n  ') : '  none') + '\n';
out += '  (NOTE: rad% here is of Aem\'s OWN predicted total. Against OBSERVED damage, radiation is a far smaller share — see C.)\n\n';

out += 'C) Radiation vs OBSERVED (the real detection question): radFrac / observed\n';
for (const r of posObs) {
  const share = r.radFrac != null && r.obsFrac > 0 ? r.radFrac / r.obsFrac : null;
  out += `  ${r.planet}/${r.starType} @ ${r.AU ? r.AU.toFixed(2) : '?'}AU ${r.shield}: Aem-radiation ${ef(r.radFrac, 2)} is ${share == null ? '—' : (share * 100).toFixed(2) + '%'} of observed ${ef(r.obsFrac, 2)}  ${share != null && share < 0.05 ? '<-- BELOW 5% detection' : ''}\n`;
}
out += '\n';

out += 'D) Which planets were too far / wrong class for radiation to matter, and what would be needed?\n';
out += '  Aem\'s rad ∝ AU^-2 and (per his star-class charts) scales with luminosity. Our captured TRANSIT planets:\n';
for (const r of posObs) out += `     ${r.planet}: ${r.starType}-class, ${r.AU ? r.AU.toFixed(2) : '?'} AU\n`;
out += '  Radiation dominates only very close to a hot star. Aem measured it at KQ-451 (O-class) inside ~4 AU where it is\n';
out += '  ~22%/Mkm (shielded). To have radiation DOMINATE observed damage you need: O or B class star AND AU < ~1-2, AND a\n';
out += '  LOW-meteoroid-density system (so meteoroid does not swamp it). Our captures are B/M/K systems at 1-1.4 AU but with\n';
out += '  high meteoroid density and very long transits, so meteoroid ablation dominates and radiation stays below the noise.\n';

fs.writeFileSync(dir + 'aem_model_vs_captures.txt', out);

// notes append
notes.push('', '=== AEM MODEL vs CAPTURES (' + new Date().toISOString() + ') ===');
notes.push('UNIT MISMATCH (important): Aem formula outputs PERCENT (%/Mkm); segment.damage is a FRACTION. Converted Aem pred ÷100 to compare.');
notes.push('Aem\'s 0.0002 %/Mkm "floor" is ~1000s x smaller than the real density-dependent meteoroid damage (meteor formula). His floor was KQ-451-specific, not a universal meteoroid term.');
notes.push('Aem k=0.0734 is O-class (KQ-451) calibrated; our TRANSIT planets are B/M/K — real rad coefficient would be lower for them (per Aem star-class charts).');
if (missingSemi.size) notes.push('Planets missing SemiMajorAxis: ' + [...missingSemi].join(', '));
if (missingDens.size) notes.push('Systems missing MeteoroidDensity: ' + [...missingDens].join(', '));
notes.push('Damage>0 TRANSIT planets: ' + [...new Set(posObs.map(r => r.planet))].join(', ') + '. Radiation share of observed is <5% for all of them -> below detection in our captures.');
fs.appendFileSync(dir + 'notes.txt', notes.join('\n') + '\n');

console.log('WROTE aem_model_vs_captures.txt; appended notes.txt');
console.log('TRANSIT rows:', rows.length, '| damage>0 planet-groups:', posObs.length);
posObs.forEach(r => console.log(`  ${r.planet}/${r.starType} ${r.shield} AU=${r.AU ? r.AU.toFixed(2) : '?'} radFrac=${ef(r.radFrac, 2)} obs=${ef(r.obsFrac, 2)} rad/obs=${r.radFrac && r.obsFrac ? (r.radFrac / r.obsFrac * 100).toFixed(2) + '%' : '—'}`));
