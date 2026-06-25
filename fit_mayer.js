'use strict';
// Fit Mayer (OZ-189a) periapsis angle and M0 from 7 DEPARTURE transferEllipse positions
// captured via SYSTEM_TRAFFIC for OZ-189 (Hypatia) system.

// --- FIO orbital elements ---
const a_m   = 112693269000;          // SMA in metres
const e     = 0.04924531653523445;   // eccentricity
const inc   = -0.05703713372349739;  // inclination (rad)
const GM    = 2.12924822493901e+20;  // m³/s²  (G × star mass)

// Derived
const p_km  = a_m * (1 - e*e) / 1000;  // semilatus rectum in km
const n_astr = Math.sqrt(GM / (a_m * a_m * a_m));  // rad/s astronomical
const n_game = n_astr * 20;             // rad/s game-speed (pass real Unix seconds)

console.log(`p_km = ${p_km.toFixed(0)} km`);
console.log(`period_real = ${(2*Math.PI/n_astr/86400).toFixed(2)} real-days`);
console.log(`period_game = ${(2*Math.PI/n_astr/86400/20).toFixed(2)} real-days (at 20× speed)`);

// --- Observed DEPARTURE positions from Mayer (OZ-189a) in System_Traffic2.txt ---
// [unix_ms, x_km, y_km, z_km]
const obs = [
  [1782359858629, 59983910.96098171,  89754052.93221217,  -3422155.172212346],
  [1782329574738, 35197349.15236415,  101480738.23728071, -2010872.0054324167],
  [1782291635668, 1246620.1737660042, 107143086.58524133, -71678.09787435718],
  [1782359597648, 59790110.12300181,  89876411.11385003,  -3414085.8022668283],
  [1782359630743, 59803367.44603796,  89863023.30308777,  -3414742.613387888],
  [1782347545465, 50280868.40544582,  95238932.66814981,  -2870535.1349297618],
  [1782291657727, 1268659.5430667638, 107132529.4486989,  -70591.75763487385],
];

// --- Kepler solver ---
function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 200; i++) {
    const dE = (E - e*Math.sin(E) - M) / (1 - e*Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-14) break;
  }
  return E;
}
function trueAnomaly(M, e) {
  const E = solveKepler(M, e);
  return 2 * Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2));
}

// --- Step 1: Compute observed radial distances ---
const data = obs.map(([ms, x, y, z]) => {
  const t = ms / 1000;
  const r = Math.sqrt(x*x + y*y + z*z);
  return { t, x, y, z, r };
});

console.log('\nObserved radial distances:');
data.forEach((d, i) => console.log(`  [${i}] t=${d.t.toFixed(0)} r=${d.r.toFixed(0)} km`));
console.log(`  a*(1-e) periapsis = ${(a_m*(1-e)/1000).toFixed(0)} km`);
console.log(`  a*(1+e) apoapsis  = ${(a_m*(1+e)/1000).toFixed(0)} km`);

// --- Step 2: Fit M0 from radial distances ---
function rPred(t, M0) {
  const M = M0 + n_game * t;
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2));
  return p_km / (1 + e * Math.cos(nu));
}

function radialResidual(M0) {
  return data.reduce((s, d) => {
    const dr = d.r - rPred(d.t, M0);
    return s + dr*dr;
  }, 0);
}

// Grid search over M0 in [0, 2π), then refine
let bestM0 = 0, bestRes = Infinity;
const N = 10000;
for (let i = 0; i < N; i++) {
  const M0 = (i / N) * 2 * Math.PI;
  const res = radialResidual(M0);
  if (res < bestRes) { bestRes = res; bestM0 = M0; }
}

// Golden-section refine
function goldenMin(f, lo, hi, tol=1e-12) {
  const phi = (Math.sqrt(5)-1)/2;
  let a = lo, b = hi;
  let c = b - phi*(b-a), d = a + phi*(b-a);
  let fc = f(c), fd = f(d);
  while (b - a > tol) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - phi*(b-a); fc = f(c); }
    else          { a = c; c = d; fc = fd; d = a + phi*(b-a); fd = f(d); }
  }
  return (a+b)/2;
}
const step = (2*Math.PI/N)*2;
const M0_fit = goldenMin(radialResidual, bestM0-step, bestM0+step);
console.log(`\nFitted M0 = ${M0_fit.toFixed(8)} rad  (RMS radial error = ${Math.sqrt(radialResidual(M0_fit)/data.length).toFixed(2)} km)`);

// --- Step 3: Fit peri_angle_rad from position directions ---
// Given M0, compute nu_i for each obs, then fit peri and (u,w) vectors
// pos_i = r_i * (cos(theta_i)*u + sin(theta_i)*w)  where theta_i = peri + nu_i
// We scan peri, and for each peri, solve for u,w by least squares, then compute residual

function getNu(t) {
  const M = M0_fit + n_game * t;
  return trueAnomaly(M, e);
}

function fitUW(thetas) {
  // Given theta values and observed unit directions, solve for u,w by least squares
  // minimize sum_i |cos(th_i)*u + sin(th_i)*w - p̂_i|²
  const nus = data.map(d => getNu(d.t));
  const pts = data.map(d => {
    const r = d.r;
    return [d.x/r, d.y/r, d.z/r];
  });

  // Build 7×2 matrix A where A[i] = [cos(theta_i), sin(theta_i)]
  // and 7×3 matrix B where B[i] = p̂_i
  // Solve A*[u;w] = B in least squares: [u;w] = pinv(A)*B
  const A = thetas.map(th => [Math.cos(th), Math.sin(th)]);

  // Manual 2×2 solve: A^T A = [[sum c², sum cs],[sum cs, sum s²]]
  let Acc=0, Acs=0, Ass=0;
  let Bcx=0, Bcy=0, Bcz=0, Bsx=0, Bsy=0, Bsz=0;
  for (let i=0; i<7; i++) {
    const [c,s] = A[i];
    const [px,py,pz] = pts[i];
    Acc+=c*c; Acs+=c*s; Ass+=s*s;
    Bcx+=c*px; Bcy+=c*py; Bcz+=c*pz;
    Bsx+=s*px; Bsy+=s*py; Bsz+=s*pz;
  }
  const det = Acc*Ass - Acs*Acs;
  const ux=(Ass*Bcx-Acs*Bsx)/det, uy=(Ass*Bcy-Acs*Bsy)/det, uz=(Ass*Bcz-Acs*Bsz)/det;
  const wx=(Acc*Bsx-Acs*Bcx)/det, wy=(Acc*Bsy-Acs*Bcy)/det, wz=(Acc*Bsz-Acs*Bcz)/det;
  return { ux,uy,uz, wx,wy,wz };
}

function totalResidual(peri) {
  const nus = data.map(d => getNu(d.t));
  const thetas = nus.map(nu => peri + nu);
  const {ux,uy,uz,wx,wy,wz} = fitUW(thetas);

  let res = 0;
  for (let i=0; i<data.length; i++) {
    const th = thetas[i];
    const r = p_km / (1 + e * Math.cos(nus[i]));
    const px = r*(Math.cos(th)*ux + Math.sin(th)*wx);
    const py = r*(Math.cos(th)*uy + Math.sin(th)*wy);
    const pz = r*(Math.cos(th)*uz + Math.sin(th)*wz);
    const dx=px-data[i].x, dy=py-data[i].y, dz=pz-data[i].z;
    res += dx*dx + dy*dy + dz*dz;
  }
  return res;
}

let bestPeri = 0, bestPeriRes = Infinity;
const NP = 10000;
for (let i=0; i<NP; i++) {
  const peri = (i/NP)*2*Math.PI;
  const res = totalResidual(peri);
  if (res < bestPeriRes) { bestPeriRes = res; bestPeri = peri; }
}
const stepP = (2*Math.PI/NP)*2;
const peri_fit = goldenMin(totalResidual, bestPeri-stepP, bestPeri+stepP);

const nus = data.map(d => getNu(d.t));
const thetas = nus.map(nu => peri_fit + nu);
const {ux,uy,uz,wx,wy,wz} = fitUW(thetas);
const umag = Math.sqrt(ux*ux+uy*uy+uz*uz);
const wmag = Math.sqrt(wx*wx+wy*wy+wz*wz);
const udotw = (ux*wx+uy*wy+uz*wz)/(umag*wmag);

console.log(`\nFitted peri_angle_rad = ${peri_fit.toFixed(8)} rad  (${(peri_fit*180/Math.PI).toFixed(4)}°)`);
console.log(`  u = (${(ux/umag).toFixed(6)}, ${(uy/umag).toFixed(6)}, ${(uz/umag).toFixed(6)})  |u|=${umag.toFixed(6)}`);
console.log(`  w = (${(wx/wmag).toFixed(6)}, ${(wy/wmag).toFixed(6)}, ${(wz/wmag).toFixed(6)})  |w|=${wmag.toFixed(6)}`);
console.log(`  u·w = ${udotw.toFixed(6)} (should be ~0)`);

// --- Step 4: Per-observation residuals ---
console.log('\nPer-observation residuals:');
for (let i=0; i<data.length; i++) {
  const th = thetas[i];
  const r = p_km / (1 + e * Math.cos(nus[i]));
  const px = r*(Math.cos(th)*(ux/umag) + Math.sin(th)*(wx/wmag));
  const py = r*(Math.cos(th)*(uy/umag) + Math.sin(th)*(wy/wmag));
  const pz = r*(Math.cos(th)*(uz/umag) + Math.sin(th)*(wz/wmag));
  const dist = Math.sqrt((px-data[i].x)**2+(py-data[i].y)**2+(pz-data[i].z)**2);
  const pct = 100*dist/data[i].r;
  console.log(`  [${i}] t=${data[i].t.toFixed(0)} residual=${dist.toFixed(0)} km (${pct.toFixed(4)}%)`);
}

// --- Compare to Marcus's ephemeris value ---
const eph = require('./public/ephemeris.json');
const marcus = eph['OZ-189a'];
if (marcus) {
  const [me, mn, mM0, mPeri, mp_km, mux, muy, muz, mwx, mwy, mwz] = marcus;
  console.log('\n--- Compare to Marcus ephemeris ---');
  console.log(`Marcus: e=${me}, n=${mn.toExponential(6)}, M0=${mM0.toFixed(8)}, peri=${mPeri.toFixed(8)} rad (${(mPeri*180/Math.PI).toFixed(4)}°)`);
  console.log(`Marcus: p_km=${mp_km.toFixed(0)}, u=(${mux.toFixed(6)},${muy.toFixed(6)},${muz.toFixed(6)}), w=(${mwx.toFixed(6)},${mwy.toFixed(6)},${mwz.toFixed(6)})`);
  console.log(`Ours:   e=${e}, n=${n_game.toExponential(6)}, M0=${M0_fit.toFixed(8)}, peri=${peri_fit.toFixed(8)} rad`);
  console.log(`Ours:   p_km=${p_km.toFixed(0)}, u=(${(ux/umag).toFixed(6)},${(uy/umag).toFixed(6)},${(uz/umag).toFixed(6)})`);

  // Validate Marcus against our observations
  console.log('\nMarcus prediction vs observations:');
  for (let i=0; i<data.length; i++) {
    const {t,x,y,z,r} = data[i];
    const M = mM0 + mn*t;
    const E = solveKepler(M, me);
    const nu = 2*Math.atan2(Math.sqrt(1+me)*Math.sin(E/2), Math.sqrt(1-me)*Math.cos(E/2));
    const rm = mp_km / (1 + me*Math.cos(nu));
    const th = mPeri + nu;
    const px = rm*(Math.cos(th)*mux + Math.sin(th)*mwx);
    const py = rm*(Math.cos(th)*muy + Math.sin(th)*mwy);
    const pz = rm*(Math.cos(th)*muz + Math.sin(th)*mwz);
    const dist = Math.sqrt((px-x)**2+(py-y)**2+(pz-z)**2);
    console.log(`  [${i}] Marcus err=${dist.toFixed(0)} km (${(100*dist/r).toFixed(4)}%)`);
  }
} else {
  console.log('\nOZ-189a NOT in Marcus ephemeris — this is a new fit!');
}
