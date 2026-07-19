const m = require('C:\\prun-tools\\prun-openmass\\blueprints_master.json');
// mirrors COMPONENT_DATA in the HTML (+ the two gaps we must add: CQT, cargo bomWeight TCB/VSC/MCB)
const HULL={LHP:4,BHP:9,RHP:10,HHP:10,AHP:10};
const CARGO={TCB:{w:20,capM3:100},VSC:{w:35,capM3:250},SCB:{w:50,capM3:500},MCB:{w:100,capM3:1000},LCB:{w:200,capM3:2000},HCB:{w:500,capM3:5000},VCB:{w:200,capM3:3000},WCB:{w:200,capM3:1000}};
const ENGW={GEN:5,FSE:6,ENG:8,AEN:14,HTE:16};
const STLW={SSL:20,MSL:50,LSL:125};
const RCTW={RCT:7,QCR:14,HPR:16,HYR:25};
const FTLW={SFL:9,MFL:24,LFL:60};
const SEATW={BGS:20,AGS:30};
const DMGW={BPT:0.02,APT:0.03,BWH:0.1,AWH:0.12,STS:0.1,BRP:0.03,ARP:0.04,SRP:0.1,RDS:50,RDL:150};
const QW={CQT:12.5,CQS:25,CQM:50,CQL:75};
const BRW={BR1:180,BR2:280,BRS:150};
// volume deltas
const dENG={ENG:0,AEN:3,GEN:-1,FSE:-1,HTE:7};
const dSTL={SSL:0,MSL:126,LSL:410};
const dRCT={RCT:0,QCR:7,HPR:117,HYR:127};
const dFTL={SFL:0,MFL:6,LFL:18};
const plateN=v=>Math.round(0.535*Math.pow(v,0.655));
const sscN=v=>Math.round(0.0478*v);

// map master option labels -> tickers
const T={engine:{STANDARD:'ENG',ADVANCED:'AEN',GLASS:'GEN',FUEL_SAVING:'FSE',HYPERTHRUST:'HTE'},
 stl:{SMALL:'SSL',MEDIUM:'MSL',LARGE:'LSL'},
 rct:{STANDARD:'RCT',QUICK_CHARGE:'QCR',HIGH_POWER:'HPR',HYPER_POWER:'HYR',NONE:null},
 ftl:{SMALL:'SFL',MEDIUM:'MFL',LARGE:'LFL',NONE:null},
 cargo:{TINY:'TCB',VERY_SMALL:'VSC',SMALL:'SCB',MEDIUM:'MCB',LARGE:'LCB',HUGE:'HCB',HIGH_VOLUME:'VCB',HIGH_LOAD:'WCB'},
 hull:{BASIC:'BHP',REINFORCED:'RHP',LIGHTWEIGHT:'LHP',ADVANCED:'AHP',HARDENED:'HHP'},
 seat:{BASIC:'BGS',ADVANCED:'AGS',NONE:null},
 drone:{SMALL:'RDS',LARGE:'RDL',NONE:null},
 heat:{BASIC:'BPT',ADVANCED:'APT',NONE:null},
 whip:{BASIC:'BWH',ADVANCED:'AWH',NONE:null},
 rad:{BASIC:'BRP',ADVANCED:'ARP',SPECIALIZED:'SRP',NONE:null},
 stab:{BASIC:'STS',NONE:null}};

function sels(b){return {
  engine:T.engine[b.sel.stlEngine.opt], stl:T.stl[b.sel.stlTank.opt], rct:T.rct[b.sel.ftlReactor.opt],
  ftl:T.ftl[b.sel.ftlTank.opt], cargo:T.cargo[b.sel.cargo.opt], hull:T.hull[b.sel.hull.opt],
  seat:T.seat[b.sel.seats.opt], drone:T.drone[b.sel.drone.opt], heat:T.heat[b.sel.heat.opt],
  whip:T.whip[b.sel.whipple.opt], rad:T.rad[b.sel.radiation.opt], stab:T.stab[b.sel.stability.opt]};}

function computeV(s){
  const cap = s.cargo ? CARGO[s.cargo].capM3 : 0;
  return 438 + 1.05*cap + (dENG[s.engine]||0) + (dSTL[s.stl]||0) + (s.rct?(dRCT[s.rct]||0):-126) + (s.ftl?(dFTL[s.ftl]||0):-3);
}
function quartersFor(V){ if(V<900)return 'CQT'; if(V<2075)return 'CQS'; if(V<2740)return 'CQM'; return 'CQL'; }

// mass chain. mode: 'assumed' uses our rules; 'actualAuto' uses the ship's real bridge/quarters/emitters
function computeMass(s,V,mode,b){
  const pc=plateN(V), sc=sscN(V);
  let mass = pc*(HULL[s.hull]||0) + sc*1;
  if(s.engine) mass+=ENGW[s.engine];
  if(s.stl)    mass+=STLW[s.stl];
  if(s.rct)    mass+=RCTW[s.rct];
  if(s.ftl)    mass+=FTLW[s.ftl];
  if(s.cargo)  mass+=CARGO[s.cargo].w;
  if(s.seat)   mass+=SEATW[s.seat];
  if(s.drone)  mass+=DMGW[s.drone];
  if(s.stab)   mass+=DMGW[s.stab];
  // shields coat every plate
  for(const k of ['heat','whip','rad']) if(s[k]) mass += pc*DMGW[s[k]];
  if(mode==='actualAuto'){
    mass += (b.bridge?BRW[b.bridge]:0) + (b.quarters?QW[b.quarters]:0) + (b.ffc>0?50:0)
          + b.emitters.SFE*0.1 + b.emitters.MFE*0.2 + b.emitters.LFE*0.4;
  } else {
    mass += (!s.rct?150:((s.rct==='HPR'||s.rct==='HYR')?280:180)); // bridge from reactor tier
    mass += QW[quartersFor(V)];               // quarters by volume band
    if(s.rct) mass += 50;                     // FFC when FTL-capable
    mass += s.rct ? 1.5 : 0;                  // emitters: small nominal set
  }
  return mass;
}
for(const mode of ['actualAuto','assumed']){
  const rows=m.map(b=>{const s=sels(b);const V=computeV(s);const p=computeMass(s,V,mode,b);
    return {id:b.naturalId,act:b.operatingEmptyMass,p,pct:100*(p-b.operatingEmptyMass)/b.operatingEmptyMass,vortex:!!b.bom.VOE};});
  const nv=rows.filter(r=>!r.vortex);
  const a=nv.map(r=>Math.abs(r.pct));
  console.log('MODE='+mode+'  (excluding the 1 vortex ship)');
  console.log('   mean|%|='+(a.reduce((s,x)=>s+x,0)/a.length).toFixed(3)+'  max|%|='+Math.max(...a).toFixed(2)+'  within1%='+a.filter(x=>x<1).length+'/'+nv.length);
  console.log('   worst: '+nv.slice().sort((x,y)=>Math.abs(y.pct)-Math.abs(x.pct)).slice(0,5).map(r=>r.id+' '+r.pct.toFixed(1)+'%').join(' | '));
}
