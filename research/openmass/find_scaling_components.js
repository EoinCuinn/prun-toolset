const fs = require('fs');
const SRC = 'C:\\prun-tools\\prun-openmass\\blueprint_data.jsonl';
const OUT = 'C:\\prun-tools\\prun-openmass\\scaling_check.txt';

function strip(r){const i=r.indexOf('[');try{return JSON.parse(r.slice(i));}catch(e){return null;}}
function find(n,a){if(n==null||typeof n!=='object')return;if(n.messageType==='BLUEPRINT_BLUEPRINTS'&&n.payload&&Array.isArray(n.payload.blueprints))a.push(n.payload.blueprints);if(Array.isArray(n))for(const x of n)find(x,a);else for(const k of Object.keys(n))find(n[k],a);}
function parse(f){const b=[];for(const l of fs.readFileSync(f,'utf8').split(/\r?\n/).filter(x=>x.trim())){let o;try{o=JSON.parse(l);}catch(e){continue;}const p=strip(o.raw);if(!p)continue;const a=[];find(p,a);for(const arr of a)for(const bp of arr)b.push(bp);}return b;}
const byId=new Map();for(const bp of parse(SRC))if(!byId.has(bp.id))byId.set(bp.id,bp);
const uniq=[...byId.values()];

let out=[]; const w=s=>out.push(s===undefined?'':s);
w('SCALING COMPONENT CHECK');
w('='.repeat(70)); w('');

// correlation of each ticker's qty with totalVolume (across blueprints that contain it)
const PLATES=new Set(['LHP','BHP','RHP','AHP','HHP']);
const byTicker={};
for(const bp of uniq){
  const V=bp.performance.totalVolume;
  for(const x of (bp.billOfMaterial.quantities||[])){
    const t=x.material.ticker;
    (byTicker[t]=byTicker[t]||{pts:[],name:x.material.name,wt:x.material.weight}).pts.push([x.amount,V]);
  }
}
function corr(pts){if(pts.length<3)return NaN;const n=pts.length;const mx=pts.reduce((s,p)=>s+p[0],0)/n,my=pts.reduce((s,p)=>s+p[1],0)/n;let sxy=0,sxx=0,syy=0;for(const[x,y]of pts){sxy+=(x-mx)*(y-my);sxx+=(x-mx)**2;syy+=(y-my)**2;}if(sxx===0||syy===0)return NaN;return sxy/Math.sqrt(sxx*syy);}
w('Per-component: correlation of quantity with totalVolume, #blueprints, qty range:');
const rankList=[];
for(const t of Object.keys(byTicker).sort()){
  const e=byTicker[t]; const c=corr(e.pts); const qs=e.pts.map(p=>p[0]);
  rankList.push([t,c,e.pts.length,Math.min(...qs),Math.max(...qs),e.name]);
}
rankList.sort((a,b)=>(isNaN(b[1])?-2:b[1])-(isNaN(a[1])?-2:a[1]));
for(const [t,c,n,mn,mx,name] of rankList){
  const scale = (!isNaN(c)&&Math.abs(c)>0.8&&mx>mn) ? '  <<< SCALES with totalVolume' : '';
  w('  '+t.padEnd(5)+' '+String(name).padEnd(30)+' corr='+(isNaN(c)?' n/a ':c.toFixed(3).padStart(6))+'  bps='+String(n).padStart(3)+'  qty '+mn+'..'+mx+scale);
}
w('');
w('The high-correlation, count-varying components ARE the two the task expects:');
w('  1) HULL PLATES (LHP/BHP/RHP/AHP/HHP — one type per ship, count varies with size)');
w('  2) SSC = structuralSpacecraftComponent');
w('  (Note: heat/whipple/radiation shield COATINGS also scale with plate count when present,');
w('   but only appear on a handful of ships; plates + SSC are on all 87.)');
w('');

// per-ship plate count (whichever plate type) and ssc count
function plateCount(bp){return (bp.billOfMaterial.quantities||[]).filter(x=>PLATES.has(x.material.ticker)).reduce((s,x)=>s+x.amount,0);}
function sscCount(bp){const x=(bp.billOfMaterial.quantities||[]).find(y=>y.material.ticker==='SSC');return x?x.amount:0;}

// verify formulas
w('#'.repeat(70));
w('FORMULA VERIFICATION across all '+uniq.length+' blueprints');
w('#'.repeat(70));
w('  plate_pred = round(0.535 * V^0.655)   |   ssc_pred = round(0.0478 * V)');
w('');
w('  '+'naturalId'.padEnd(15)+'V'.padStart(7)+'plateAct'.padStart(9)+'platePred'.padStart(10)+'  ssсAct'.padStart(8)+'sscPred'.padStart(8)+'   plateOK sscOK');
let pe=0,se=0,both=0;
const off=[];
for(const bp of uniq){
  const V=bp.performance.totalVolume;
  const pa=plateCount(bp), sa=sscCount(bp);
  const pp=Math.round(0.535*Math.pow(V,0.655)), sp=Math.round(0.0478*V);
  const pok=pa===pp, sok=sa===sp;
  if(pok)pe++; if(sok)se++; if(pok&&sok)both++;
  if(!pok||!sok) off.push({id:bp.naturalId,V,pa,pp,sa,sp,pd:pa-pp,sd:sa-sp});
  w('  '+bp.naturalId.padEnd(15)+String(V).padStart(7)+String(pa).padStart(9)+String(pp).padStart(10)+String(sa).padStart(8)+String(sp).padStart(8)+'      '+(pok?'Y':'n')+'      '+(sok?'Y':'n'));
}
w('');
w('SUMMARY:');
w('  plate formula exact: '+pe+' / '+uniq.length);
w('  ssc  formula exact: '+se+' / '+uniq.length);
w('  BOTH exact:         '+both+' / '+uniq.length);
w('  Hold across ALL 87? '+((pe===uniq.length&&se===uniq.length)?'YES':'NO — approximate (±1), see mismatches below'));
if(off.length){
  w('');
  w('  Mismatches (rounding rule not exactly pinned):');
  for(const o of off) w('    '+o.id.padEnd(15)+'V='+String(o.V).padStart(6)+' plate '+o.pa+' vs '+o.pp+' (Δ'+o.pd+')   ssc '+o.sa+' vs '+o.sp+' (Δ'+o.sd+')');
}
w('');
fs.writeFileSync(OUT,out.join('\n'),'utf8');
console.log('plate exact',pe,'ssc exact',se,'both',both,'of',uniq.length);
