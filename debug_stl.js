// debug_stl.js — trace stlRendezvous for HRT → Promitor/Helion at current time
// Run: node --input-type=commonjs < debug_stl.js

const fs = require('fs');
const eph = JSON.parse(fs.readFileSync('public/ephemeris.json', 'utf8'));
const stationData = JSON.parse(fs.readFileSync('public/station_data.json', 'utf8'));
const reductionSurface = JSON.parse(fs.readFileSync('public/insystem_reduction_surface.json', 'utf8'));

const NOW = 1782460000; // June 26, 2026 approximate
const KM_TO_M = 1000;

function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 100; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

function planetXYZFromEph(naturalId, unixT) {
  const b = eph[naturalId];
  if (!b) return null;
  const [e, n, M0, peri, p_km, ux, uy, uz, wx, wy, wz] = b;
  const Ma = M0 + n * unixT;
  const E  = solveKepler(Ma, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r  = p_km / (1 + e * Math.cos(nu));
  const th = peri + nu;
  const ct = r * Math.cos(th), st = r * Math.sin(th);
  return {
    x: (ct * ux + st * wx) * KM_TO_M,
    y: (ct * uy + st * wy) * KM_TO_M,
    z: (ct * uz + st * wz) * KM_TO_M,
  };
}

function stationXYZ(st, t) {
  if (st.e != null && st.a_km && st.n_rad_s && st.t_peri_s != null) {
    const TAU = 2 * Math.PI;
    const M = ((st.n_rad_s * (t - st.t_peri_s)) % TAU + TAU) % TAU;
    const E = solveKepler(M, st.e);
    const sqep = Math.sqrt(1 + st.e), sqem = Math.sqrt(1 - st.e);
    const f = 2 * Math.atan2(sqep * Math.sin(E / 2), sqem * Math.cos(E / 2));
    const r = st.a_km * (1 - st.e * Math.cos(E));
    const theta = st.theta_peri_rad - f;
    return {
      x: r * Math.cos(theta) * 1000,
      y: r * Math.sin(theta) * 1000,
      z: (st.z_amplitude_km != null ? st.z_amplitude_km * Math.sin(theta + st.z_theta_phase_rad) : st.z_km) * 1000,
    };
  }
  const dt = t - st.t_ref_s;
  const theta = st.theta_ref_rad + st.omega_rad_s * dt;
  return {
    x: st.r_km * Math.cos(theta) * 1000,
    y: st.r_km * Math.sin(theta) * 1000,
    z: (st.z_amplitude_km != null ? st.z_amplitude_km * Math.sin(st.omega_rad_s * dt + st.z_phi0_rad) : st.z_km) * 1000,
  };
}

function carlsonRF(x, y, z) {
  let xi = x, yi = y, zi = z;
  let mu = (xi+yi+zi)/3;
  let dx = (mu-xi)/mu, dy = (mu-yi)/mu, dz = (mu-zi)/mu;
  for (let n = 0; n < 50; n++) {
    if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) <= 1e-10) break;
    const lam = Math.sqrt(xi*yi) + Math.sqrt(yi*zi) + Math.sqrt(zi*xi);
    xi = (xi+lam)/4; yi = (yi+lam)/4; zi = (zi+lam)/4;
    mu = (xi+yi+zi)/3;
    dx = (mu-xi)/mu; dy = (mu-yi)/mu; dz = (mu-zi)/mu;
  }
  const E2 = dx*dy - dz*dz, E3 = dx*dy*dz;
  return (1 - E2/10 + E3/14 + E2*E2/24 - 3*E2*E3/44) / Math.sqrt(mu);
}

function carlsonRD(x, y, z) {
  let xi = x, yi = y, zi = z, sum = 0, fac = 1;
  let mu = (xi+yi+3*zi)/5;
  let dx = (mu-xi)/mu, dy = (mu-yi)/mu, dz = (mu-zi)/mu;
  for (let n = 0; n < 50; n++) {
    if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) <= 1e-10) break;
    const lam = Math.sqrt(xi*yi) + Math.sqrt(yi*zi) + Math.sqrt(zi*xi);
    sum += fac / (Math.sqrt(zi) * (zi + lam));
    xi = (xi+lam)/4; yi = (yi+lam)/4; zi = (zi+lam)/4;
    fac *= 0.25;
    mu = (xi+yi+3*zi)/5;
    dx = (mu-xi)/mu; dy = (mu-yi)/mu; dz = (mu-zi)/mu;
  }
  const E2 = dx*dy - 6*dz*dz, E3 = dx*dy*dz;
  return 3*sum + fac*(1 - 3*E2/14 + E3/6 + 9*E2*E2/88 - 9*E2*E3/52)/(mu*Math.sqrt(mu));
}

function ellipticEIncomplete(psi, m) {
  if (psi === 0) return 0;
  const s = Math.sin(psi), c2 = Math.cos(psi) ** 2;
  const y = 1 - m * s * s;
  if (y <= 0) return s;
  return s * carlsonRF(c2, y, 1) - (m / 3) * s * s * s * carlsonRD(c2, y, 1);
}

function calculateSltDistance3D(Ox, Oy, Oz, Px, Py, Pz, verbose) {
  const rO = Math.hypot(Ox, Oy, Oz), rP = Math.hypot(Px, Py, Pz);
  if (!rO || !rP) return null;

  const a = (rO + rP) / 2;
  const dx = Px-Ox, dy = Py-Oy, dz = Pz-Oz;
  const u = Math.hypot(dx, dy, dz);
  if (u < 1) return { chargedKm: 0, arcKm: 0, isReduced: false };

  const uhx = dx/u, uhy = dy/u, uhz = dz/u;

  const Nx = Oy*Pz - Oz*Py, Ny = Oz*Px - Ox*Pz, Nz = Ox*Py - Oy*Px;
  const Nmag = Math.hypot(Nx, Ny, Nz);
  if (Nmag < 1e-10) return null;
  const Nhx = Nx/Nmag, Nhy = Ny/Nmag, Nhz = Nz/Nmag;

  const e2x = Nhy*uhz - Nhz*uhy;
  const e2y = Nhz*uhx - Nhx*uhz;
  const e2z = Nhx*uhy - Nhy*uhx;

  const s = (rP*rP - rO*rO + u*u) / (2*u);
  const h2 = rP*rP - s*s;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2);

  const starCross = -(Ox*e2x + Oy*e2y + Oz*e2z);
  const sign = starCross > 0 ? 1 : -1;

  const Fpx = Ox + s*uhx + sign*h*e2x;
  const Fpy = Oy + s*uhy + sign*h*e2y;
  const Fpz = Oz + s*uhz + sign*h*e2z;

  const Cx = Fpx/2, Cy = Fpy/2, Cz = Fpz/2;
  const c = Math.hypot(Cx, Cy, Cz);
  if (c >= a) return null;

  const m = Math.min((c/a)**2, 0.999999999);
  const b = a * Math.sqrt(1 - m);

  const cMag = c || 1;
  const majHx = -Cx/cMag, majHy = -Cy/cMag, majHz = -Cz/cMag;
  const minHx = Nhy*majHz - Nhz*majHy;
  const minHy = Nhz*majHx - Nhx*majHz;
  const minHz = Nhx*majHy - Nhy*majHx;

  const SOx = Ox-Cx, SOy = Oy-Cy, SOz = Oz-Cz;
  const POx = Px-Cx, POy = Py-Cy, POz = Pz-Cz;
  const E1 = Math.atan2((SOx*minHx+SOy*minHy+SOz*minHz)/b, (SOx*majHx+SOy*majHy+SOz*majHz)/a);
  const E2 = Math.atan2((POx*minHx+POy*minHy+POz*minHz)/b, (POx*majHx+POy*majHy+POz*majHz)/a);

  const deltaE = ((E2-E1+Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
  const psi = Math.abs(deltaE) / 2;

  const l = 2 * a * ellipticEIncomplete(psi, m);
  const e_transfer = Math.sqrt(m);

  if (verbose) {
    console.log(`  rO=${(rO/1e9).toFixed(2)}Gm rP=${(rP/1e9).toFixed(2)}Gm chord=${(u/1e9).toFixed(2)}Gm`);
    console.log(`  a=${(a/1e9).toFixed(2)}Gm c=${(c/1e9).toFixed(2)}Gm e_t=${e_transfer.toFixed(4)}`);
    console.log(`  E1=${(E1*180/Math.PI).toFixed(2)}° E2=${(E2*180/Math.PI).toFixed(2)}° deltaE=${(deltaE*180/Math.PI).toFixed(2)}°`);
    console.log(`  psi=${(psi*180/Math.PI).toFixed(2)}° arc=${(l/1e9).toFixed(3)}Gm`);
    console.log(`  deltaE<0? ${deltaE < 0}`);
  }

  if (deltaE >= 0) {
    return { chargedKm: l/1000, arcKm: l/1000, isReduced: false, E1, e_transfer };
  } else {
    let factor = 1.0;
    if (reductionSurface) {
      const { NE, NA, grid } = reductionSurface;
      const fe = Math.max(0, Math.min(e_transfer, 1.0)) * (NE - 1);
      const ie = Math.min(Math.floor(fe), NE - 2);
      const te = fe - ie;
      const fa = (E1 + Math.PI) / (2 * Math.PI) * (NA - 1);
      const ia = Math.min(Math.max(Math.floor(fa), 0), NA - 2);
      const ta = fa - ia;
      factor = grid[ie][ia]*(1-te)*(1-ta) + grid[ie+1][ia]*te*(1-ta)
             + grid[ie][ia+1]*(1-te)*ta + grid[ie+1][ia+1]*te*ta;
      if (verbose) console.log(`  REDUCED: factor=${factor.toFixed(4)}`);
    }
    const charged = l * factor;
    return { chargedKm: charged/1000, arcKm: l/1000, isReduced: true, E1, e_transfer };
  }
}

function stlTimeReal(dKm, M, accel) {
  if (!dKm || !accel || M <= 0) return null;
  if (dKm <= 4 * accel * M * M) return 2 * Math.sqrt(dKm / accel);
  return dKm / (2 * accel * M) + 2 * M;
}

function planetVelocityKmS(t, getPos, pl) {
  const p1 = getPos(pl, t - 0.5);
  const p2 = getPos(pl, t + 0.5);
  if (!p1 || !p2) return null;
  return { vx: (p2.x - p1.x) / 1000, vy: (p2.y - p1.y) / 1000 };
}

function progradeAngoff(gate, body, vbody) {
  const prog = body.x * vbody.vy - body.y * vbody.vx;
  let ang = Math.atan2(gate.y, gate.x) - Math.atan2(body.y, body.x);
  ang = ((ang + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return ang * (prog !== 0 ? Math.sign(prog) : 1);
}

function departureDeficit(arc, M, accel, O, P, vbody) {
  const rO = Math.hypot(O.x, O.y), rP = Math.hypot(P.x, P.y);
  if (!rO || !rP) return 0;
  const rho = Math.max(rO, rP) / Math.min(rO, rP);
  const vbm = Math.hypot(vbody.vx, vbody.vy);
  const th = progradeAngoff(P, O, vbody);
  if (!(th > 0 && th < Math.PI / 2)) return 0;
  const w0 = vbm * (rho * rho - 1) * Math.cos(th);
  return Math.min(2 * M * w0 - w0 * w0 / (2 * accel), 0.95 * arc);
}

function leverageDeficit(O, P, vbody, T) {
  const rO = Math.hypot(O.x, O.y), rP = Math.hypot(P.x, P.y);
  if (!rO || !rP) return 0;
  const rho = Math.max(rO, rP) / Math.min(rO, rP);
  const vbm = Math.hypot(vbody.vx, vbody.vy);
  const th = progradeAngoff(O, P, vbody);
  if (!(th > -Math.PI / 2 && th < 0)) return 0;
  return vbm * (rho * rho - 1) * Math.cos(th) * T;
}

function traceRendezvous(label, destId, M, accel) {
  const HRT = stationData['HRT'];
  const getOriginPos = (_, tt) => stationXYZ(HRT, tt);
  const getDestPos   = (pl, tt) => planetXYZFromEph(destId, tt);

  console.log(`\n=== HRT → ${label} (M=${M}, accel=${accel}) ===`);
  const S = getOriginPos(null, NOW);
  console.log(`Origin HRT at NOW: (${(S.x/1e9).toFixed(2)}, ${(S.y/1e9).toFixed(2)}, ${(S.z/1e9).toFixed(2)}) Gm`);
  console.log(`HRT |r|: ${(Math.hypot(S.x,S.y,S.z)/1e9).toFixed(2)} Gm`);

  const vel1 = planetVelocityKmS(NOW, getOriginPos, null);
  console.log(`HRT velocity: (${vel1.vx.toFixed(1)}, ${vel1.vy.toFixed(1)}) km/s, |v|=${Math.hypot(vel1.vx,vel1.vy).toFixed(1)} km/s`);

  let tFlight = 2 * M;
  for (let i = 0; i < 25; i++) {
    const arriveT = NOW + tFlight;
    const P = getDestPos(null, arriveT);
    if (!P) { console.log('  getPos2 returned null'); return; }

    const verbose = i < 3;
    if (verbose) {
      console.log(`\n  Iter ${i}: tFlight=${tFlight.toFixed(1)}s (${(tFlight/3600).toFixed(2)}h)`);
      console.log(`  Dest at arriveT: (${(P.x/1e9).toFixed(2)}, ${(P.y/1e9).toFixed(2)}, ${(P.z/1e9).toFixed(2)}) Gm`);
    }

    const slt = calculateSltDistance3D(S.x, S.y, S.z, P.x, P.y, P.z, verbose);
    if (slt == null) { console.log(`  Iter ${i}: slt=null`); return; }

    let d = slt.chargedKm;
    const depDef = vel1 ? departureDeficit(d, M, accel, S, P, vel1) : 0;
    d = Math.max(0, d - depDef);

    const isTriangular = d <= 4 * accel * M * M;
    let levDef = 0;
    if (isTriangular) {
      const vel2 = planetVelocityKmS(arriveT, getDestPos, null);
      if (vel2) levDef = leverageDeficit(S, P, vel2, tFlight);
      d = Math.max(0, d - levDef);
    }

    const newT = stlTimeReal(d, M, accel);
    if (newT == null) { console.log(`  Iter ${i}: stlTimeReal=null`); return; }

    if (verbose) {
      console.log(`  arc=${(slt.arcKm/1e6).toFixed(2)}M km charged_before_def=${(slt.chargedKm/1e6).toFixed(2)}M km`);
      console.log(`  depDef=${(depDef/1e6).toFixed(3)}M km levDef=${(levDef/1e6).toFixed(3)}M km d=${(d/1e6).toFixed(2)}M km`);
      console.log(`  newT=${newT.toFixed(1)}s diff=${(newT-tFlight).toFixed(1)}s`);
    }

    if (Math.abs(newT - tFlight) < 0.5) {
      console.log(`\n  CONVERGED at iter ${i}: tFlight=${tFlight.toFixed(1)}s`);
      console.log(`  arc=${(slt.arcKm/1e6).toFixed(2)}M km charged=${(d/1e6).toFixed(2)}M km`);
      console.log(`  depDef=${(depDef/1e6).toFixed(3)}M km levDef=${(levDef/1e6).toFixed(3)}M km`);
      return;
    }
    tFlight = newT;
  }
  console.log(`  DID NOT CONVERGE after 25 iters (last tFlight=${tFlight.toFixed(1)}s, charged=${tFlight/(2*accel*M)*2*accel*M})`);
}

// Test cases matching the user's reported bug
for (const M of [10, 20, 50, 100]) {
  traceRendezvous('Promitor (VH-331a)', 'VH-331a', M, 70);
}
traceRendezvous('Helion Prime (VH-331d)', 'VH-331d', 20, 70);
traceRendezvous('Avalon (VH-331g)', 'VH-331g', 20, 70);
