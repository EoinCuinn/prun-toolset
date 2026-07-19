const fs = require('fs');
const SRC = 'C:\\prun-tools\\prun-openmass\\blueprint_data.jsonl';
const OUT = 'C:\\prun-tools\\prun-openmass\\lookup_table.json';
const RPT = 'C:\\prun-tools\\prun-openmass\\lookup_report.txt';

function strip(r){const i=r.indexOf('[');try{return JSON.parse(r.slice(i));}catch(e){return null;}}
function find(n,a){if(n==null||typeof n!=='object')return;if(n.messageType==='BLUEPRINT_BLUEPRINTS'&&n.payload&&Array.isArray(n.payload.blueprints))a.push(n.payload.blueprints);if(Array.isArray(n))for(const x of n)find(x,a);else for(const k of Object.keys(n))find(n[k],a);}
function parse(f){const b=[];for(const l of fs.readFileSync(f,'utf8').split(/\r?\n/).filter(x=>x.trim())){let o;try{o=JSON.parse(l);}catch(e){continue;}const p=strip(o.raw);if(!p)continue;const a=[];find(p,a);for(const arr of a)for(const bp of arr)b.push(bp);}return b;}
const byId=new Map();for(const bp of parse(SRC))if(!byId.has(bp.id))byId.set(bp.id,bp);
const uniq=[...byId.values()];

// 12 fields as ordered ticker-sets (matches how the hypo UI dropdowns / damage checkboxes work).
// Order MUST match the key built in rebuildHypo.
const FIELDS = [
  ['engine',    ['ENG','GEN','FSE','AEN','HTE']],
  ['stlTank',   ['SSL','MSL','LSL']],
  ['reactor',   ['RCT','QCR','HPR','HYR']],
  ['ftlTank',   ['SFL','MFL','LFL']],
  ['cargo',     ['TCB','VSC','SCB','MCB','LCB','HCB','VCB','WCB']],
  ['hull',      ['LHP','BHP','RHP','AHP','HHP']],
  ['heat',      ['BPT','APT']],
  ['whipple',   ['BWH','AWH']],
  ['stability', ['STS']],
  ['radiation', ['BRP','ARP','SRP']],
  ['drone',     ['RDS','RDL']],
  ['seats',     ['BGS','AGS']],
];

function keyOf(bp){
  const present = new Set((bp.billOfMaterial.quantities||[]).filter(x=>x.amount>0).map(x=>x.material.ticker));
  return FIELDS.map(([name,set])=>{ const t=set.find(tk=>present.has(tk)); return t||'NONE'; }).join('|');
}

// group blueprints by 12-key
const groups=new Map();
for(const bp of uniq){
  const k=keyOf(bp);
  if(!groups.has(k)) groups.set(k,[]);
  groups.get(k).push(bp);
}

// build lookup + detect OEM collisions (same key, different OEM)
const lookup={};
const collisions=[];
const details=[];
const r2 = x => Math.round(x*100)/100;
for(const [k,members] of groups){
  const oems=[...new Set(members.map(m=>r2(m.performance.operatingEmptyMass)))];
  if(oems.length>1) collisions.push({key:k,oems,ids:members.map(m=>m.naturalId)});
  const rep=members[0];
  lookup[k]={ m:r2(rep.performance.operatingEmptyMass), bp:rep.naturalId, n:members.length };
  details.push({key:k, oem:r2(rep.performance.operatingEmptyMass), n:members.length, ids:members.map(m=>m.naturalId), V:rep.performance.totalVolume});
}
fs.writeFileSync(OUT, JSON.stringify(lookup));

let out=[]; const w=s=>out.push(s===undefined?'':s);
w('LOOKUP TABLE BUILD — 12-selection -> operatingEmptyMass');
w('='.repeat(70));
w('Blueprints: '+uniq.length+'   distinct 12-selection combos: '+groups.size);
w('Key field order: '+FIELDS.map(f=>f[0]).join(' | '));
w('Key format: ticker per field, or NONE. e.g. ENG|MSL|RCT|SFL|LCB|RHP|NONE|NONE|STS|NONE|RDS|BGS');
w('');
w('OEM collisions (same 12-key -> different operatingEmptyMass): '+collisions.length);
if(collisions.length){
  for(const c of collisions) w('  * '+c.key+'  OEMs='+c.oems.join('/')+'  ['+c.ids.join(', ')+']');
  w('  (a collision means the 12 selections alone do NOT pin OEM for that combo)');
} else {
  w('  none — every distinct 12-combo maps to a single operatingEmptyMass. Lookup is well-defined.');
}
w('');
w('All '+groups.size+' combos (key | OEM | #blueprints | representative | totalVolume):');
details.sort((a,b)=>a.oem-b.oem);
for(const d of details) w('  '+d.oem.toFixed(1).padStart(8)+'  x'+String(d.n).padStart(2)+'  '+d.ids[0].padEnd(14)+' V='+String(d.V).padStart(6)+'  '+d.key);
w('');
fs.writeFileSync(RPT,out.join('\n'),'utf8');

console.log('combos',groups.size,'collisions',collisions.length,'lookup entries',Object.keys(lookup).length);
console.log('json bytes', fs.statSync(OUT).size);
