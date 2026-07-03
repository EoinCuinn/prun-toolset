// Solve for correct 'peri' in Marcus's ephemeris format from ground truth game positions.
// Ground truth from ephemeris_check.js flight exports (AVI-047P1).

function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 100; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

// Marcus's planetXYZFromEph — returns position in metres given unixT (real seconds)
function ephPos(b, unixT, peri_override) {
  const [e, n, M0, peri, p_km, ux, uy, uz, wx, wy, wz] = b;
  const p = peri_override !== undefined ? peri_override : peri;
  const Ma = M0 + n * unixT;
  const E  = solveKepler(Ma, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r  = p_km / (1 + e * Math.cos(nu));
  const th = p + nu;
  const ct = r * Math.cos(th), st = r * Math.sin(th);
  return {
    x: (ct * ux + st * wx) * 1000,
    y: (ct * uy + st * wy) * 1000,
    z: (ct * uz + st * wz) * 1000,
    nu, r, th_without_peri: nu,
  };
}

// Solve for peri from a single ground truth position.
// Given the ephemeris (e, n, M0, p_km, u, w), and known pos_m (in metres),
// compute nu from time, then derive th = atan2(dot(w,pos/r), dot(u,pos/r)), peri = th - nu.
function solvePeriFromObs(b, unixT, truth_m) {
  const [e, n, M0, peri_placeholder, p_km, ux, uy, uz, wx, wy, wz] = b;
  const Ma = M0 + n * unixT;
  const E  = solveKepler(Ma, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));

  const { x, y, z } = truth_m;
  const r_truth = Math.hypot(x, y, z);

  // Project normalised position onto u and w unit vectors
  const cos_th = (x * ux + y * uy + z * uz) / r_truth;
  const sin_th = (x * wx + y * wy + z * wz) / r_truth;
  const th     = Math.atan2(sin_th, cos_th);
  const peri   = th - nu;

  // Residual with this peri
  const pred = ephPos(b, unixT, peri);
  const err_m = Math.hypot(pred.x - x, pred.y - y, pred.z - z);

  return { peri, peri_deg: peri * 180 / Math.PI, nu, th, err_m, err_pct: err_m / r_truth * 100 };
}

const fs = require('fs');
const eph = JSON.parse(fs.readFileSync('public/ephemeris.json', 'utf8'));

// Ground truth positions from ephemeris_check.js (SCALE=1000 means export units × 1000 = metres)
const SCALE = 1000;
const observations = [
  {
    id: 'VH-331g', label: 'Avalon @ departure 1956-export',
    t_ms: 1782208838882,
    truth: { x: 178790600 * SCALE, y: -419582191 * SCALE, z: 12043313 * SCALE },
  },
  {
    id: 'VH-331d', label: 'Helion @ arrival 1956-export',
    t_ms: 1782214675882,
    truth: { x: 49489161 * SCALE, y: 59503279 * SCALE, z: 2383980 * SCALE },
  },
  {
    id: 'VH-331g', label: 'Avalon @ departure 2045-export',
    t_ms: 1782211880136,
    truth: { x: 178302166 * SCALE, y: -419812410 * SCALE, z: 12007489 * SCALE },
  },
  {
    id: 'VH-331d', label: 'Helion @ arrival 2045-export',
    t_ms: 1782217705136,
    truth: { x: 50518669 * SCALE, y: 58664385 * SCALE, z: 2433573 * SCALE },
  },
];

console.log('=== Current peri (placeholder π) residuals ===\n');
for (const obs of observations) {
  const b = eph[obs.id];
  if (!b) { console.log(`${obs.id}: NOT IN EPHEMERIS`); continue; }
  const pred = ephPos(b, obs.t_ms / 1000);
  const err = Math.hypot(pred.x - obs.truth.x, pred.y - obs.truth.y, pred.z - obs.truth.z);
  const r   = Math.hypot(obs.truth.x, obs.truth.y, obs.truth.z);
  console.log(`${obs.label}: error ${(err/1e6).toFixed(1)} Mm (${(err/r*100).toFixed(3)}%)`);
}

console.log('\n=== Solved peri per observation ===\n');
const periByPlanet = {};
for (const obs of observations) {
  const b = eph[obs.id];
  if (!b) continue;
  const result = solvePeriFromObs(b, obs.t_ms / 1000, obs.truth);
  console.log(`${obs.label}:`);
  console.log(`  peri = ${result.peri.toFixed(8)} rad  (${result.peri_deg.toFixed(4)}°)`);
  console.log(`  residual with solved peri: ${(result.err_m/1e6).toFixed(3)} Mm (${result.err_pct.toFixed(4)}%)`);
  if (!periByPlanet[obs.id]) periByPlanet[obs.id] = [];
  periByPlanet[obs.id].push(result.peri);
}

console.log('\n=== Recommended peri values (mean across observations) ===\n');
for (const [id, values] of Object.entries(periByPlanet)) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const spread = Math.max(...values) - Math.min(...values);
  console.log(`${id}: peri = ${mean.toFixed(8)} rad  (${(mean*180/Math.PI).toFixed(4)}°)  spread = ${(spread*180/Math.PI).toFixed(4)}°`);

  // Verify with mean peri
  const b = eph[id];
  console.log('  Verification:');
  for (const obs of observations.filter(o => o.id === id)) {
    const pred = ephPos(b, obs.t_ms / 1000, mean);
    const err  = Math.hypot(pred.x - obs.truth.x, pred.y - obs.truth.y, pred.z - obs.truth.z);
    const r    = Math.hypot(obs.truth.x, obs.truth.y, obs.truth.z);
    console.log(`    ${obs.label.split('@')[1].trim()}: ${(err/r*100).toFixed(4)}%`);
  }
}

console.log('\n=== Comparison: ω from ephemeris_check.js (in radians) ===');
console.log('Avalon ω_ccw = -179.76° =', (-179.76 * Math.PI / 180).toFixed(8), 'rad');
console.log('Helion ω_ccw = -175.79° =', (-175.79 * Math.PI / 180).toFixed(8), 'rad');
console.log('-ω_ccw for Avalon =', (179.76 * Math.PI / 180).toFixed(8), 'rad');
console.log('-ω_ccw for Helion =', (175.79 * Math.PI / 180).toFixed(8), 'rad');
