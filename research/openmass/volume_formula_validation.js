const m = require('C:\\prun-tools\\prun-openmass\\blueprints_master.json');
const CAPM3={TCB:100,VSC:250,SCB:500,MCB:1000,LCB:2000,HCB:5000,VCB:3000,WCB:1000};
// per-option additive terms measured from clean one-field-change pairs (Δ vs reference)
const eng={STANDARD:0,ADVANCED:3,GLASS:-1,FUEL_SAVING:-1,HYPERTHRUST:7};
const stl={SMALL:0,MEDIUM:126,LARGE:410};
const rct={STANDARD:0,NONE:-126,QUICK_CHARGE:7,HIGH_POWER:117,HYPER_POWER:127};
const ftl={SMALL:0,NONE:-3,MEDIUM:6,LARGE:18};
const cargoOptTicker={TINY:'TCB',VERY_SMALL:'VSC',SMALL:'SCB',MEDIUM:'MCB',LARGE:'LCB',HUGE:'HCB',HIGH_VOLUME:'VCB',HIGH_LOAD:'WCB'};
const BASE=438; // = 963 - 1.05*500

function predict(b){
  const c=CAPM3[cargoOptTicker[b.sel.cargo.opt]];
  return BASE + 1.05*c + (eng[b.sel.stlEngine.opt]??null) + (stl[b.sel.stlTank.opt]??null) + (rct[b.sel.ftlReactor.opt]??null) + (ftl[b.sel.ftlTank.opt]??null);
}
let rows=m.map(b=>{const p=predict(b);return {id:b.naturalId,V:b.totalVolume,p:p==null?NaN:p,err:p-b.totalVolume,pct:100*(p-b.totalVolume)/b.totalVolume,vortex:!!b.bom.VOE};});
const good=rows.filter(r=>!isNaN(r.err));
const abs=good.map(r=>Math.abs(r.err));
console.log('ADDITIVE PREDICTOR: totalVolume = 438 + 1.05*cargo_capM3 + engineΔ + stlTankΔ + reactorΔ + ftlTankΔ');
console.log('  predicted for '+good.length+'/'+m.length+' blueprints');
console.log('  mean|err| = '+(abs.reduce((s,x)=>s+x,0)/abs.length).toFixed(2)+' m³   max|err| = '+Math.max(...abs).toFixed(0));
console.log('  mean|%|   = '+(good.reduce((s,r)=>s+Math.abs(r.pct),0)/good.length).toFixed(3)+'%   within 1%: '+good.filter(r=>Math.abs(r.pct)<1).length+'/'+good.length+'   within 0.5%: '+good.filter(r=>Math.abs(r.pct)<0.5).length);
console.log('  EXACT (|err|<0.5): '+good.filter(r=>Math.abs(r.err)<0.5).length+'/'+good.length);
console.log('\n  worst 10:');
for(const r of good.slice().sort((a,b)=>Math.abs(b.err)-Math.abs(a.err)).slice(0,10))
  console.log('   '+r.id.padEnd(14)+' actual '+String(r.V).padStart(5)+'  pred '+r.p.toFixed(0).padStart(5)+'  err '+(r.err>=0?'+':'')+r.err.toFixed(0)+' ('+r.pct.toFixed(2)+'%)'+(r.vortex?'  [VORTEX ship]':''));
