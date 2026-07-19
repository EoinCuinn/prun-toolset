const fs = require('fs');
const SRC = 'C:\\prun-tools\\prun-openmass\\blueprint_data.jsonl';
const OUT = 'C:\\prun-tools\\prun-openmass\\fixed_mass_check.txt';

function strip(r){const i=r.indexOf('[');try{return JSON.parse(r.slice(i));}catch(e){return null;}}
function find(n,a){if(n==null||typeof n!=='object')return;if(n.messageType==='BLUEPRINT_BLUEPRINTS'&&n.payload&&Array.isArray(n.payload.blueprints))a.push(n.payload.blueprints);if(Array.isArray(n))for(const x of n)find(x,a);else for(const k of Object.keys(n))find(n[k],a);}
function parse(f){const b=[];for(const l of fs.readFileSync(f,'utf8').split(/\r?\n/).filter(x=>x.trim())){let o;try{o=JSON.parse(l);}catch(e){continue;}const p=strip(o.raw);if(!p)continue;const a=[];find(p,a);for(const arr of a)for(const bp of arr)b.push(bp);}return b;}
const byId=new Map();for(const bp of parse(SRC))if(!byId.has(bp.id))byId.set(bp.id,bp);
const uniq=[...byId.values()];

const PLATES=new Set(['LHP','BHP','RHP','AHP','HHP']);
// tickers that belong to the 12 user-selectable fields (excluding hull plates which are scaling)
const TWELVE=new Set(['ENG','GEN','FSE','AEN','HTE','SSL','MSL','LSL','RCT','QCR','HPR','HYR','SFL','MFL','LFL','SCB','MCB','LCB','HCB','TCB','VSC','VCB','WCB','BPT','APT','BWH','AWH','STS','BRP','ARP','SRP','RDS','RDL','BGS','AGS']);
// "extra" auto-added components NOT among the 12 fields
const EXTRA=new Set(['BR1','BR2','BRS','CQS','CQM','CQL','CQT','FFC','SFE','MFE','LFE','HAM','VFT','VOE']);
const SHIELD_COAT=new Set(['BPT','APT','BWH','AWH','BRP','ARP','SRP']); // qty scales with plate count

const FIELD_TYPES=['STL_ENGINE','STL_FUEL_TANK','FTL_REACTOR','FTL_FUEL_TANK','CARGO_BAY','HULL_TYPE','HEAT_SHIELD','WHIPPLE_SHIELD','GRAVITY_SHIELD','RADIATION_SHIELD','REPAIR_DRONES','HIGH_G_SEATS'];
function optOf(bp,t){const s=(bp.selections||[]).find(x=>x.type===t);return s&&s.option!=null?s.option:'NONE';}
function key12(bp){return FIELD_TYPES.map(t=>optOf(bp,t)).join('|');}

function comps(bp){return bp.billOfMaterial.quantities||[];}
function plateMass(bp){return comps(bp).filter(x=>PLATES.has(x.material.ticker)).reduce((s,x)=>s+x.material.weight*x.amount,0);}
function sscMass(bp){const x=comps(bp).find(y=>y.material.ticker==='SSC');return x?x.material.weight*x.amount:0;}
function massBy(bp,set){return comps(bp).filter(x=>set.has(x.material.ticker)).reduce((s,x)=>s+x.material.weight*x.amount,0);}

let out=[]; const w=s=>out.push(s===undefined?'':s);
w('FIXED-MASS DETERMINISM CHECK');
w('='.repeat(70));
w('fixed_mass = operatingEmptyMass − plateMass − sscMass   (using ACTUAL counts from BOM)');
w('Question: is fixed_mass fully determined by the 12 user-selected fields?');
w('');

const rows=[];
for(const bp of uniq){
  const oem=bp.performance.operatingEmptyMass;
  const pm=plateMass(bp), sm=sscMass(bp);
  const fixed=oem-pm-sm;
  const twelve=massBy(bp,TWELVE);
  const extra=massBy(bp,EXTRA);
  const coat=massBy(bp,SHIELD_COAT); // part of `twelve` that actually scales with plates
  rows.push({id:bp.naturalId,V:bp.performance.totalVolume,oem,pm:+pm.toFixed(2),sm,fixed:+fixed.toFixed(2),twelve:+twelve.toFixed(2),extra:+extra.toFixed(2),coat:+coat.toFixed(2),key:key12(bp)});
}

// 1) reconciliation: fixed should equal twelve+extra (both computed from BOM)
let reconOK=0; for(const r of rows) if(Math.abs(r.fixed-(r.twelve+r.extra))<0.01) reconOK++;
w('Reconciliation (fixed_mass == twelveMass + extraMass): '+reconOK+' / '+uniq.length+' exact  (sanity check of the split)');
w('');

// 2) how much of fixed_mass is EXTRA (non-12) components?
const extras=rows.map(r=>r.extra);
const nzExtra=rows.filter(r=>r.extra>0.01).length;
w('EXTRA (non-12) component mass per ship — bridge / crew quarters / FFC / emitters / habitation / vortex:');
w('  ships with nonzero extra mass: '+nzExtra+' / '+uniq.length);
w('  extra mass range: '+Math.min(...extras).toFixed(2)+' .. '+Math.max(...extras).toFixed(2)+'  (mean '+(extras.reduce((s,x)=>s+x,0)/extras.length).toFixed(2)+')');
w('  => if this is nonzero and varies, fixed_mass includes mass NOT selected via the 12 fields.');
w('');

// 3) shield-coating scaling inside fixed_mass
const coatShips=rows.filter(r=>r.coat>0.01);
w('Shield-coating mass inside fixed_mass (heat/whipple/rad — these ALSO scale with plate count):');
w('  ships with shield coatings: '+coatShips.length+' / '+uniq.length+'  (coat mass up to '+Math.max(...rows.map(r=>r.coat)).toFixed(2)+')');
w('  => for these ships fixed_mass is NOT constant with size — coatings scale like the plates.');
w('');

// 4) determinism via duplicate 12-selection keys
const keyMap=new Map();
for(const r of rows){ if(!keyMap.has(r.key)) keyMap.set(r.key,[]); keyMap.get(r.key).push(r); }
const distinct=keyMap.size;
const dupGroups=[...keyMap.values()].filter(g=>g.length>1);
w('DETERMINISM via duplicates:');
w('  distinct 12-selection combinations among '+uniq.length+' blueprints: '+distinct);
w('  groups sharing an identical 12-selection combo: '+dupGroups.length);
if(dupGroups.length===0){
  w('  => EVERY blueprint has a UNIQUE 12-field combination. There are NO repeats, so "same');
  w('     selections → same fixed_mass" CANNOT be confirmed by duplication — it is untestable');
  w('     this way. (This alone does not prove determinism.)');
} else {
  let consistent=0;
  for(const g of dupGroups){ const f=g.map(x=>x.fixed); if(Math.max(...f)-Math.min(...f)<0.5) consistent++; else {
    w('     * INCONSISTENT: key gives fixed_mass '+g.map(x=>x.id+'='+x.fixed).join(', '));
  }}
  w('  consistent duplicate groups (same fixed_mass): '+consistent+' / '+dupGroups.length);
}
w('');

// per-blueprint table
w('#'.repeat(70));
w('PER-BLUEPRINT');
w('#'.repeat(70));
w('  '+'naturalId'.padEnd(15)+'V'.padStart(7)+'OEM'.padStart(9)+'plateM'.padStart(9)+'sscM'.padStart(7)+'fixed'.padStart(9)+'12M'.padStart(9)+'extraM'.padStart(8)+'coatM'.padStart(8));
for(const r of rows.sort((a,b)=>b.extra-a.extra)){
  w('  '+r.id.padEnd(15)+String(r.V).padStart(7)+String(r.oem).padStart(9)+r.pm.toFixed(1).padStart(9)+String(r.sm).padStart(7)+r.fixed.toFixed(1).padStart(9)+r.twelve.toFixed(1).padStart(9)+r.extra.toFixed(1).padStart(8)+r.coat.toFixed(1).padStart(8));
}
w('');
w('CONCLUSION (Step 3):');
const detBlocked = nzExtra>0 || coatShips.length>0;
w('  Is fixed_mass fully determined by the 12 user-selected fields? '+(detBlocked?'NO.':'plausibly, needs the key test'));
if(detBlocked){
  w('  Reasons:');
  if(nzExtra>0) w('   - '+nzExtra+' ships carry EXTRA mass from components outside the 12 fields (command bridge,');
  if(nzExtra>0) w('     crew quarters, FTL field controller, FTL emitters, habitation, vortex). That mass is real');
  if(nzExtra>0) w('     empty mass and is NOT captured by the 12 selections unless the game DERIVES those parts');
  if(nzExtra>0) w('     from the 12 (which cannot be confirmed here — every 12-combo is unique, no repeats).');
  if(coatShips.length>0) w('   - '+coatShips.length+' ships have shield coatings whose count scales with plate count, so their');
  if(coatShips.length>0) w('     fixed_mass changes with SIZE — there are effectively MORE than two scaling components.');
}
w('');
fs.writeFileSync(OUT,out.join('\n'),'utf8');
console.log('recon',reconOK,'distinctKeys',distinct,'dupGroups',dupGroups.length,'nzExtra',nzExtra,'coatShips',coatShips.length);
console.log('extra mass range', Math.min(...extras).toFixed(1),'..',Math.max(...extras).toFixed(1));
