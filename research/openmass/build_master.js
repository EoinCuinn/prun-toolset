const fs = require('fs');
const SRC = 'C:\\prun-tools\\prun-openmass\\blueprint_data.jsonl';
const OUT = 'C:\\prun-tools\\prun-openmass\\blueprints_master.json';

function strip(r){const i=r.indexOf('[');try{return JSON.parse(r.slice(i));}catch(e){return null;}}
function find(n,a){if(n==null||typeof n!=='object')return;if(n.messageType==='BLUEPRINT_BLUEPRINTS'&&n.payload&&Array.isArray(n.payload.blueprints))a.push(n.payload.blueprints);if(Array.isArray(n))for(const x of n)find(x,a);else for(const k of Object.keys(n))find(n[k],a);}
function parse(f){const b=[];for(const l of fs.readFileSync(f,'utf8').split(/\r?\n/).filter(x=>x.trim())){let o;try{o=JSON.parse(l);}catch(e){continue;}const p=strip(o.raw);if(!p)continue;const a=[];find(p,a);for(const arr of a)for(const bp of arr)b.push(bp);}return b;}
const byId=new Map();for(const bp of parse(SRC))if(!byId.has(bp.id))byId.set(bp.id,bp);
const uniq=[...byId.values()];

// 12 user-selectable fields: label -> selection type
const FIELDS=[['stlEngine','STL_ENGINE'],['stlTank','STL_FUEL_TANK'],['ftlReactor','FTL_REACTOR'],['ftlTank','FTL_FUEL_TANK'],['cargo','CARGO_BAY'],['hull','HULL_TYPE'],['heat','HEAT_SHIELD'],['whipple','WHIPPLE_SHIELD'],['stability','GRAVITY_SHIELD'],['radiation','RADIATION_SHIELD'],['drone','REPAIR_DRONES'],['seats','HIGH_G_SEATS']];
const PLATES=new Set(['LHP','BHP','RHP','AHP','HHP']);
function selOf(bp,type){const s=(bp.selections||[]).find(x=>x.type===type);if(!s)return {option:'NONE',short:'NONE',material:null};const short=(s.option||'NONE').replace(type+'_','').replace('HULL_PLATES_','');return {option:s.option||'NONE',short,material:s.optionMaterialName||null,amount:s.amount};}

const master=uniq.map(bp=>{
  const q=(bp.billOfMaterial.quantities||[]);
  const bom={}; for(const x of q) bom[x.material.ticker]={qty:x.amount,weight:x.material.weight,volume:x.material.volume,name:x.material.name};
  const sel={}; for(const [lab,t] of FIELDS){ const s=selOf(bp,t); sel[lab]={opt:s.short,mat:s.material}; }
  const plate=q.filter(x=>PLATES.has(x.material.ticker));
  const plateTicker=plate[0]?plate[0].material.ticker:null;
  const plateCount=plate.reduce((s,x)=>s+x.amount,0);
  const key12=FIELDS.map(([lab])=>sel[lab].opt).join('|');
  return {
    naturalId:bp.naturalId,
    name:bp.name||'',
    totalVolume:bp.performance.totalVolume,
    operatingEmptyMass:bp.performance.operatingEmptyMass,
    sscCount:(bom.SSC?bom.SSC.qty:0),
    plateTicker, plateCount,
    plateWeight:(plate[0]?plate[0].material.weight:null),
    emitters:{SFE:(bom.SFE?bom.SFE.qty:0),MFE:(bom.MFE?bom.MFE.qty:0),LFE:(bom.LFE?bom.LFE.qty:0)},
    bridge:(bom.BR1?'BR1':bom.BR2?'BR2':bom.BRS?'BRS':null),
    quarters:(bom.CQS?'CQS':bom.CQM?'CQM':bom.CQL?'CQL':bom.CQT?'CQT':null),
    ffc:(bom.FFC?bom.FFC.qty:0),
    sel,          // the 12 user fields {opt, mat}
    key12,        // pipe-joined 12-field key for quick diffing/matching
    bom,          // full bill of material: ticker -> {qty, weight, volume, name}
  };
});

fs.writeFileSync(OUT, JSON.stringify(master));
// pretty index for humans too
const idx = master.map(m=>({id:m.naturalId,name:m.name,V:m.totalVolume,OEM:m.operatingEmptyMass,SSC:m.sscCount,key12:m.key12}));
fs.writeFileSync('C:\\prun-tools\\prun-openmass\\blueprints_master_index.json', JSON.stringify(idx,null,0));

console.log('master records:', master.length, '->', OUT, '('+fs.statSync(OUT).size+' bytes)');
console.log('per-record fields:', Object.keys(master[0]).join(', '));
console.log('12 selection fields:', FIELDS.map(f=>f[0]).join(', '));
console.log('sample:', JSON.stringify({id:master[0].naturalId, V:master[0].totalVolume, OEM:master[0].operatingEmptyMass, SSC:master[0].sscCount, sel:Object.fromEntries(Object.entries(master[0].sel).map(([k,v])=>[k,v.opt]))}));
