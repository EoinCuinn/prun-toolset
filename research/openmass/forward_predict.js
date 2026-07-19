const fs = require('fs');
const SRC = 'C:\\prun-tools\\prun-openmass\\blueprint_data.jsonl';
const OUT = 'C:\\prun-tools\\prun-openmass\\forward_prediction.txt';

function strip(r){const i=r.indexOf('[');try{return JSON.parse(r.slice(i));}catch(e){return null;}}
function find(n,a){if(n==null||typeof n!=='object')return;if(n.messageType==='BLUEPRINT_BLUEPRINTS'&&n.payload&&Array.isArray(n.payload.blueprints))a.push(n.payload.blueprints);if(Array.isArray(n))for(const x of n)find(x,a);else for(const k of Object.keys(n))find(n[k],a);}
function parse(f){const b=[];for(const l of fs.readFileSync(f,'utf8').split(/\r?\n/).filter(x=>x.trim())){let o;try{o=JSON.parse(l);}catch(e){continue;}const p=strip(o.raw);if(!p)continue;const a=[];find(p,a);for(const arr of a)for(const bp of arr)b.push(bp);}return b;}
const byId=new Map();for(const bp of parse(SRC))if(!byId.has(bp.id))byId.set(bp.id,bp);
const uniq=[...byId.values()];

const PLATES=new Set(['LHP','BHP','RHP','AHP','HHP']);
const FIELD_TYPES=['STL_ENGINE','STL_FUEL_TANK','FTL_REACTOR','FTL_FUEL_TANK','CARGO_BAY','HULL_TYPE','HEAT_SHIELD','WHIPPLE_SHIELD','GRAVITY_SHIELD','RADIATION_SHIELD','REPAIR_DRONES','HIGH_G_SEATS'];
function optOf(bp,t){const s=(bp.selections||[]).find(x=>x.type===t);return s&&s.option!=null?s.option:'NONE';}
function key12(bp){return FIELD_TYPES.map(t=>optOf(bp,t)).join('|');}
function comps(bp){return bp.billOfMaterial.quantities||[];}
function plateInfo(bp){const ps=comps(bp).filter(x=>PLATES.has(x.material.ticker));const cnt=ps.reduce((s,x)=>s+x.amount,0);const wt=ps[0]?ps[0].material.weight:0;return {cnt,wt};}
function sscCnt(bp){const x=comps(bp).find(y=>y.material.ticker==='SSC');return x?x.amount:0;}
function plateMass(bp){return comps(bp).filter(x=>PLATES.has(x.material.ticker)).reduce((s,x)=>s+x.material.weight*x.amount,0);}
function sscMass(bp){const x=comps(bp).find(y=>y.material.ticker==='SSC');return x?x.material.weight*x.amount:0;}

const fPlate=V=>Math.round(0.535*Math.pow(V,0.655));
const fSsc=V=>Math.round(0.0478*V);

let out=[]; const w=s=>out.push(s===undefined?'':s);
w('FORWARD PREDICTION of operatingEmptyMass');
w('='.repeat(70));
w('');
w('MODEL:');
w('  operatingEmptyMass = fixed_mass(12 selections)');
w('                     + plateCount(V) * plateUnitWeight(hull type)');
w('                     + sscCount(V)  * 1');
w('  where  plateCount(V) = round(0.535 * V^0.655)   [approximate]');
w('         sscCount(V)   = round(0.0478 * V)         [approximate]');
w('         V = totalVolume  (REQUIRED INPUT — still not derivable from the 12 selections)');
w('  fixed_mass is a fixed value per 12-selection combo (Step 3: 9/9 duplicate groups agree).');
w('');

// prove size-independence: do duplicate 12-combos span different V but same fixed_mass?
const rows=uniq.map(bp=>({bp,id:bp.naturalId,V:bp.performance.totalVolume,oem:bp.performance.operatingEmptyMass,fixed:+(bp.performance.operatingEmptyMass-plateMass(bp)-sscMass(bp)).toFixed(2),key:key12(bp)}));
const km=new Map();for(const r of rows){if(!km.has(r.key))km.set(r.key,[]);km.get(r.key).push(r);}
w('SIZE-INDEPENDENCE of fixed_mass (duplicate 12-combos at DIFFERENT totalVolume):');
let sizeVaryingGroups=0;
for(const g of [...km.values()].filter(g=>g.length>1)){
  const Vs=[...new Set(g.map(r=>r.V))];
  const fixedSpread=Math.max(...g.map(r=>r.fixed))-Math.min(...g.map(r=>r.fixed));
  if(Vs.length>1){ sizeVaryingGroups++;
    w('  '+g.map(r=>r.id).join(', ')+'  V={'+Vs.join(',')+'}  fixed_mass={'+[...new Set(g.map(r=>r.fixed))].join(',')+'}  spread '+fixedSpread.toFixed(2));
  }
}
w('  => '+sizeVaryingGroups+' duplicate groups span different sizes yet keep the SAME fixed_mass');
w('     (if >0, fixed_mass is confirmed size-independent AND selection-determined).');
w('');

// accuracy: predicted mass using FORMULA counts + each ship\'s own fixed_mass
w('#'.repeat(70));
w('ACCURACY across all 87  (fixed_mass = actual per-combo value; counts from the FORMULAS)');
w('#'.repeat(70));
w('  '+'naturalId'.padEnd(15)+'V'.padStart(7)+'actualOEM'.padStart(10)+'predOEM'.padStart(10)+'absErr'.padStart(9)+'pctErr'.padStart(8));
let errs=[], exact=0;
const errRows=[];
for(const r of rows){
  const {cnt:pa,wt:pw}=plateInfo(r.bp); const sa=sscCnt(r.bp);
  const pred = r.fixed + fPlate(r.V)*pw + fSsc(r.V)*1;
  const err = pred - r.oem;
  if(Math.abs(err)<0.5)exact++;
  errs.push(err);
  errRows.push({id:r.id,V:r.V,oem:r.oem,pred:+pred.toFixed(2),err:+err.toFixed(2),pct:100*err/r.oem});
}
for(const e of errRows.sort((a,b)=>Math.abs(b.err)-Math.abs(a.err)))
  w('  '+e.id.padEnd(15)+String(e.V).padStart(7)+String(e.oem).padStart(10)+e.pred.toFixed(1).padStart(10)+e.err.toFixed(1).padStart(9)+e.pct.toFixed(2).padStart(8));
const abs=errs.map(Math.abs);
w('');
w('SUMMARY (formula counts):');
w('  exact (|err|<0.5t): '+exact+' / '+uniq.length);
w('  mean |abs err| : '+(abs.reduce((s,x)=>s+x,0)/abs.length).toFixed(2)+' t');
w('  max  |abs err| : '+Math.max(...abs).toFixed(2)+' t');
w('  mean |% err|   : '+(errRows.reduce((s,e)=>s+Math.abs(e.pct),0)/errRows.length).toFixed(3)+' %');
w('  max  |% err|   : '+Math.max(...errRows.map(e=>Math.abs(e.pct))).toFixed(3)+' %');
w('  ALL error here comes from the plate/ssc COUNT formulas being approximate (Step 2: 52/87');
w('  both-exact). With the ACTUAL counts, prediction = OEM exactly (fixed_mass + plate + ssc');
w('  is an identity by construction). So the mass model is exact; the residual is the count rule.');
w('');
w('CAVEATS for a genuinely hypothetical build:');
w('  1. totalVolume (V) is still required as an input — it is NOT derived from the 12 selections.');
w('  2. plate/ssc COUNT formulas are approximate (±1), giving the small errors above.');
w('  3. fixed_mass for a combo already in the 87 is a lookup; for a NOVEL 12-combo you must');
w('     reconstruct it from the selected parts PLUS the game-derived extras (bridge, crew');
w('     quarters, FTL controller, emitters). Step 3 shows those extras ARE determined by the 12,');
w('     but the explicit 12->extras rule still has to be built from the data (not done here).');
w('  4. 15 ships carry shield coatings whose count also scales with plates — for those, part of');
w('     fixed_mass scales with size too (a 3rd/4th scaling term), so treat shielded hypotheticals');
w('     with care.');
w('');
fs.writeFileSync(OUT,out.join('\n'),'utf8');
console.log('sizeVaryingGroups',sizeVaryingGroups,'exact',exact,'/',uniq.length);
console.log('mean|err|',(abs.reduce((s,x)=>s+x,0)/abs.length).toFixed(2),'max|err|',Math.max(...abs).toFixed(2),'mean%',(errRows.reduce((s,e)=>s+Math.abs(e.pct),0)/errRows.length).toFixed(3),'max%',Math.max(...errRows.map(e=>Math.abs(e.pct))).toFixed(3));
