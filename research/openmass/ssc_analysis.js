const fs = require('fs');
const SRC = 'C:\\prun-tools\\prun-openmass\\blueprint_data.jsonl';
const OUT = 'C:\\prun-tools\\prun-openmass\\ssc_analysis.txt';

function strip(r){const i=r.indexOf('[');try{return JSON.parse(r.slice(i));}catch(e){return null;}}
function find(n,a){if(n==null||typeof n!=='object')return;if(n.messageType==='BLUEPRINT_BLUEPRINTS'&&n.payload&&Array.isArray(n.payload.blueprints))a.push(n.payload.blueprints);if(Array.isArray(n))for(const x of n)find(x,a);else for(const k of Object.keys(n))find(n[k],a);}
function parse(f){const b=[];for(const l of fs.readFileSync(f,'utf8').split(/\r?\n/).filter(x=>x.trim())){let o;try{o=JSON.parse(l);}catch(e){continue;}const p=strip(o.raw);if(!p)continue;const a=[];find(p,a);for(const arr of a)for(const bp of arr)b.push(bp);}return b;}
const byId=new Map();for(const bp of parse(SRC))if(!byId.has(bp.id))byId.set(bp.id,bp);
const uniq=[...byId.values()];

// 12 fields (label -> selection type). short option = strip common prefix for readability.
const FIELDS=[['STLeng','STL_ENGINE'],['STLtank','STL_FUEL_TANK'],['FTLrct','FTL_REACTOR'],['FTLtank','FTL_FUEL_TANK'],['cargo','CARGO_BAY'],['hull','HULL_TYPE'],['heat','HEAT_SHIELD'],['whipple','WHIPPLE_SHIELD'],['stability','GRAVITY_SHIELD'],['radiation','RADIATION_SHIELD'],['drone','REPAIR_DRONES'],['seats','HIGH_G_SEATS']];
function optOf(bp,t){const s=(bp.selections||[]).find(x=>x.type===t);let o=s&&s.option!=null?s.option:'NONE';return o.replace(t+'_','').replace('HULL_PLATES_','');}
function sscOf(bp){const x=(bp.billOfMaterial.quantities||[]).find(y=>y.material.ticker==='SSC');return x?x.amount:0;}
function emitters(bp){const q={};for(const x of bp.billOfMaterial.quantities)q[x.material.ticker]=x.amount;return (q.SFE||0)+'/'+(q.MFE||0)+'/'+(q.LFE||0);}

const rows=uniq.map(bp=>{const o={};for(const[lab,t]of FIELDS)o[lab]=optOf(bp,t);return {id:bp.naturalId,ssc:sscOf(bp),V:bp.performance.totalVolume,emit:emitters(bp),sel:o};});

let out=[]; const w=s=>out.push(s===undefined?'':s);
w('SSC (Structure) COUNT ANALYSIS — which of the 12 fields drive it');
w('='.repeat(78));
w('Prior context: SSC count ≈ round(0.0478 × totalVolume). So "what affects SSC" == "what');
w('affects totalVolume". This tests that directly. '+uniq.length+' blueprints.');
w('');

// ---------- STEP 1 ----------
w('#'.repeat(78));
w('STEP 1 — PER-BLUEPRINT (SSC, the 3 focus fields, and all other selections)');
w('#'.repeat(78));
w('  '+'naturalId'.padEnd(14)+'SSC'.padStart(4)+'  V'.padStart(7)+'  STLtank'.padEnd(9)+' FTLtank'.padEnd(8)+' cargo'.padEnd(11)+'| STLeng FTLrct hull heat whip stab rad drone seats  (emit S/M/L)');
for(const r of rows.sort((a,b)=>a.ssc-b.ssc)){
  const s=r.sel;
  w('  '+r.id.padEnd(14)+String(r.ssc).padStart(4)+String(r.V).padStart(8)+'  '+String(s.STLtank).padEnd(9)+String(s.FTLtank).padEnd(8)+String(s.cargo).padEnd(11)+'| '+[s.STLeng,s.FTLrct,s.hull,s.heat,s.whipple,s.stability,s.radiation,s.drone,s.seats].join(' ')+'  ('+r.emit+')');
}
w('');

// ---------- STEP 2 ----------
w('#'.repeat(78));
w('STEP 2 — GROUP BY (STL tank + FTL tank + cargo): is SSC determined by these 3?');
w('#'.repeat(78));
const g3=new Map();
for(const r of rows){const k=r.sel.STLtank+' | '+r.sel.FTLtank+' | '+r.sel.cargo;if(!g3.has(k))g3.set(k,[]);g3.get(k).push(r);}
let multiGroups=0, varyingGroups=0;
w('  '+'STLtank | FTLtank | cargo'.padEnd(34)+'#bp'.padStart(4)+'  SSC values (distinct)');
for(const [k,members] of [...g3.entries()].sort((a,b)=>b[1].length-a[1].length)){
  const sscs=[...new Set(members.map(m=>m.ssc))].sort((a,b)=>a-b);
  if(members.length>1) multiGroups++;
  if(sscs.length>1) varyingGroups++;
  w('  '+k.padEnd(34)+String(members.length).padStart(4)+'  {'+sscs.join(', ')+'}'+(sscs.length>1?'   <-- SSC VARIES within group':''));
}
w('');
w('  distinct 3-field groups: '+g3.size+'   |  groups with >1 blueprint: '+multiGroups+'   |  groups where SSC varies: '+varyingGroups);
const determined = varyingGroups===0;
w('  => SSC fully determined by (STL tank + FTL tank + cargo)? '+(determined?'YES':'NO'));
if(!determined) w('     At least '+varyingGroups+' group(s) have the SAME 3 fields but DIFFERENT SSC → other fields matter.');
w('');

// ---------- STEP 3 ----------
w('#'.repeat(78));
w('STEP 3 — WHICH OTHER FIELDS AFFECT SSC (single-field-difference pairs)');
w('#'.repeat(78));
w('Method: compare every pair of blueprints that differ in EXACTLY ONE of the 12 fields.');
w('If SSC differs, that field affects SSC (directly or via the auto-added parts it triggers).');
w('');
const labels=FIELDS.map(f=>f[0]);
function diffFields(a,b){const d=[];for(const l of labels)if(a.sel[l]!==b.sel[l])d.push(l);return d;}
const perField={}; for(const l of labels) perField[l]={pairs:0,sscChanged:0,examples:[]};
for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const d=diffFields(rows[i],rows[j]);
  if(d.length===1){ const f=d[0]; const pf=perField[f]; pf.pairs++;
    const changed=rows[i].ssc!==rows[j].ssc;
    if(changed) pf.sscChanged++;
    if(pf.examples.length<4) pf.examples.push({a:rows[i],b:rows[j],f});
  }
}
w('  '+'field'.padEnd(11)+'1-field-diff pairs'.padStart(18)+'  SSC changed in'.padStart(16)+'   verdict');
for(const l of labels){const pf=perField[l];
  const verdict = pf.pairs===0 ? 'no isolated pairs — UNTESTED' : (pf.sscChanged>0 ? 'AFFECTS SSC' : 'no SSC change observed');
  w('  '+l.padEnd(11)+String(pf.pairs).padStart(18)+String(pf.sscChanged).padStart(16)+'   '+verdict);
}
w('');
w('  Examples of isolated single-field changes and their SSC/V effect:');
for(const l of labels){const pf=perField[l];
  if(pf.examples.length===0) continue;
  const ex=pf.examples.filter(e=>e.a.ssc!==e.b.ssc)[0]||pf.examples[0];
  w('   ['+l+'] '+ex.a.id+' ('+ex.a.sel[l]+', SSC '+ex.a.ssc+', V '+ex.a.V+')  vs  '+ex.b.id+' ('+ex.b.sel[l]+', SSC '+ex.b.ssc+', V '+ex.b.V+')');
}
w('');
// relationship SSC vs V
let sscExact=0; for(const r of rows) if(Math.round(0.0478*r.V)===r.ssc) sscExact++;
w('  SSC vs totalVolume: SSC == round(0.0478 × V) holds '+sscExact+' / '+uniq.length+' (±1 otherwise).');
w('  Since SSC tracks V, ANY field that changes V changes SSC. The pair table above shows which');
w('  fields were actually observed to move it in this dataset.');
w('');

// ---------- STEP 4 ----------
w('#'.repeat(78));
w('STEP 4 — CAPTURE GAPS (fields with no isolated 1-field-difference pair)');
w('#'.repeat(78));
const untested=labels.filter(l=>perField[l].pairs===0);
if(untested.length===0){
  w('  Every one of the 12 fields has at least one isolated single-field-difference pair, so each');
  w('  field\'s effect on SSC is directly testable from existing data. No captures strictly needed');
  w('  to answer "does field X affect SSC".');
} else {
  w('  These fields have NO pair differing in only that field, so their isolated effect on SSC is');
  w('  not directly observable yet:');
  for(const l of untested){
    // find the field type + options to suggest a capture
    w('   - '+l+': build two ships identical in the other 11 fields but differing only in '+l+',');
    w('     then compare SSC. Suggested: take a common reference build and swap only '+l+'.');
  }
}
w('');
w('  NOTE: SSC ultimately follows totalVolume, and totalVolume is the still-unsolved game rule.');
w('  Even a complete map of "which fields affect SSC" does not yield SSC for a NOVEL build without');
w('  knowing totalVolume. To pin the SSC rule as a clean formula you would additionally need');
w('  ladders that vary ONE volume-driving field across several sizes (e.g. cargo Small→Huge with');
w('  everything else fixed) to confirm SSC = round(0.0478 × V) and nail the exact rounding.');
w('');
fs.writeFileSync(OUT,out.join('\n'),'utf8');

console.log('groups3',g3.size,'multi',multiGroups,'varying',varyingGroups,'determined',determined);
console.log('field effects:');
for(const l of labels)console.log('  '+l.padEnd(10),'pairs',perField[l].pairs,'sscChanged',perField[l].sscChanged);
console.log('untested fields:',untested.join(', ')||'none');
console.log('SSC==round(0.0478V):',sscExact,'/',uniq.length);
