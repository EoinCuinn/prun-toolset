const fs = require('fs');
const SRC = 'C:\\prun-tools\\prun-openmass\\blueprint_data.jsonl';
const OUT = 'C:\\prun-tools\\prun-openmass\\blueprint_dump.txt';

function strip(r){const i=r.indexOf('[');try{return JSON.parse(r.slice(i));}catch(e){return null;}}
function find(n,a){if(n==null||typeof n!=='object')return;if(n.messageType==='BLUEPRINT_BLUEPRINTS'&&n.payload&&Array.isArray(n.payload.blueprints))a.push(n.payload.blueprints);if(Array.isArray(n))for(const x of n)find(x,a);else for(const k of Object.keys(n))find(n[k],a);}
function parse(f){const b=[];for(const l of fs.readFileSync(f,'utf8').split(/\r?\n/).filter(x=>x.trim())){let o;try{o=JSON.parse(l);}catch(e){continue;}const p=strip(o.raw);if(!p)continue;const a=[];find(p,a);for(const arr of a)for(const bp of arr)b.push(bp);}return b;}
const byId=new Map();for(const bp of parse(SRC))if(!byId.has(bp.id))byId.set(bp.id,bp);
const uniq=[...byId.values()];

let out=[]; const w=s=>out.push(s===undefined?'':s);
w('BLUEPRINT DUMP — '+uniq.length+' blueprints');
w('='.repeat(70));
for(const bp of uniq){
  w('');
  w(bp.naturalId+'   '+(bp.name||'(no name)'));
  w('  totalVolume        = '+bp.performance.totalVolume);
  w('  operatingEmptyMass = '+bp.performance.operatingEmptyMass);
  w('  components (ticker | name | qty | unitWeight | unitVolume):');
  const q=(bp.billOfMaterial&&bp.billOfMaterial.quantities)||[];
  for(const x of q){
    w('    '+String(x.material.ticker).padEnd(5)+' | '+String(x.material.name).padEnd(30)+' | qty '+String(x.amount).padStart(4)+' | wt '+String(x.material.weight).padStart(7)+' | vol '+String(x.material.volume).padStart(7));
  }
}
fs.writeFileSync(OUT,out.join('\n'),'utf8');
console.log('wrote '+OUT+' ('+uniq.length+' blueprints, '+out.length+' lines)');
