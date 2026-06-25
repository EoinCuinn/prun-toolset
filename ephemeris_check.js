// Ephemeris verification: FIO orbital elements vs game export ground truth
// Tests ecc accuracy and solves for argument of periapsis (ω)
// Ground truth: transferEllipse startPosition/targetPosition from AVI-047P1 exports

const G_SI = 6.6743e-11;
const REFERENCE_TIME_S = 1451690603;
const starMass = 5.451043498327814e29;
const GM_real = G_SI * starMass; // m³/s²

function worldTime(unixT_ms) {
  const t = unixT_ms / 1000;
  return REFERENCE_TIME_S + (t - REFERENCE_TIME_S) * 20;
}

function solveKepler(M, ecc) {
  let E = M;
  for (let i = 0; i < 100; i++) {
    const dE = (M - E + ecc * Math.sin(E)) / (1 - ecc * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

// Full 3D orbital position with argument of periapsis ω and RAAN Ω
function planetXYZ(unixT_ms, a_m, ecc, inc, omega = 0, RA = 0) {
  const wt = worldTime(unixT_ms);
  const n = Math.sqrt(GM_real / (a_m ** 3));
  const Ma = ((n * wt) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const E = solveKepler(Ma, ecc);
  const x_orb = a_m * (Math.cos(E) - ecc);
  const y_orb = a_m * Math.sqrt(1 - ecc * ecc) * Math.sin(E);

  // Rotate by ω (argument of periapsis, in orbital plane)
  const x1 = x_orb * Math.cos(omega) - y_orb * Math.sin(omega);
  const y1 = x_orb * Math.sin(omega) + y_orb * Math.cos(omega);

  // Rotate by inclination (around x-axis)
  const x2 = x1;
  const y2 = y1 * Math.cos(inc);
  const z2 = y1 * Math.sin(inc);

  // Rotate by RAAN (around z-axis)
  const x = x2 * Math.cos(RA) - y2 * Math.sin(RA);
  const y = x2 * Math.sin(RA) + y2 * Math.cos(RA);
  const z = z2;

  return { x, y, z };
}

function dist(p1, p2) {
  return Math.sqrt((p1.x-p2.x)**2 + (p1.y-p2.y)**2 + (p1.z-p2.z)**2);
}

// Export positions are in in-game frame (real metres / 1000) → multiply by 1000
const SCALE = 1000;

// FIO orbital elements
const HELION = { a: 79371143000, ecc: 0.031304843723773956, inc: 0.048134561628103256, RA: 0 };
const AVALON = { a: 440950812000, ecc: 0.0379902645945549,   inc: 0.06725677847862244,  RA: 0 };

// Ground truth: [timestamp_ms, {x,y,z} in export units]
// Export 1956: TRANSIT departure = Avalon at t_dep; TRANSIT arrival = Helion at t_arr
// Export 2045: same structure
const GROUND_TRUTH = [
  {
    label: 'Avalon @ 1956-export departure',
    planet: AVALON,
    t_ms: 1782208838882,
    truth: { x: 178790600 * SCALE, y: -419582191 * SCALE, z: 12043313 * SCALE }
  },
  {
    label: 'Helion @ 1956-export arrival',
    planet: HELION,
    t_ms: 1782214675882,
    truth: { x: 49489161 * SCALE, y: 59503279 * SCALE, z: 2383980 * SCALE }
  },
  {
    label: 'Avalon @ 2045-export departure',
    planet: AVALON,
    t_ms: 1782211880136,
    truth: { x: 178302166 * SCALE, y: -419812410 * SCALE, z: 12007489 * SCALE }
  },
  {
    label: 'Helion @ 2045-export arrival',
    planet: HELION,
    t_ms: 1782217705136,
    truth: { x: 50518669 * SCALE, y: 58664385 * SCALE, z: 2433573 * SCALE }
  },
];

// --- Step 1: FIO elements as-is (ω=0) ---
console.log('=== Step 1: FIO elements, ω=0, current code ===\n');
for (const obs of GROUND_TRUTH) {
  const pred = planetXYZ(obs.t_ms, obs.planet.a, obs.planet.ecc, obs.planet.inc);
  const err_m = dist(pred, obs.truth);
  const r = Math.sqrt(obs.truth.x**2 + obs.truth.y**2 + obs.truth.z**2);
  const err_pct = err_m / r * 100;
  console.log(`${obs.label}`);
  console.log(`  truth r = ${(r/1e9).toFixed(3)} Gm`);
  console.log(`  pred  r = ${(Math.sqrt(pred.x**2+pred.y**2+pred.z**2)/1e9).toFixed(3)} Gm`);
  console.log(`  3D position error = ${(err_m/1e6).toFixed(1)} Mm  (${err_pct.toFixed(3)}% of r)`);
  console.log();
}

// --- Step 2: Solve for ω per planet that minimises position error ---
console.log('=== Step 2: Solve for best-fit ω per planet ===\n');

function totalError(planet, observations, omega) {
  return observations.reduce((sum, obs) => {
    if (obs.planet !== planet) return sum;
    const pred = planetXYZ(obs.t_ms, planet.a, planet.ecc, planet.inc, omega, planet.RA);
    return sum + dist(pred, obs.truth) ** 2;
  }, 0);
}

function solveOmega(planet, observations) {
  // Golden-section search over [-π, π]
  let lo = -Math.PI, hi = Math.PI;
  const phi = (1 + Math.sqrt(5)) / 2;
  let x1 = hi - (hi - lo) / phi;
  let x2 = lo + (hi - lo) / phi;
  for (let i = 0; i < 200; i++) {
    if (totalError(planet, observations, x1) < totalError(planet, observations, x2)) {
      hi = x2;
    } else {
      lo = x1;
    }
    x1 = hi - (hi - lo) / phi;
    x2 = lo + (hi - lo) / phi;
    if (Math.abs(hi - lo) < 1e-9) break;
  }
  return (lo + hi) / 2;
}

for (const [name, planet] of [['Avalon', AVALON], ['Helion Prime', HELION]]) {
  const omega_best = solveOmega(planet, GROUND_TRUTH);
  const deg = omega_best * 180 / Math.PI;

  console.log(`${name}: best-fit ω = ${deg.toFixed(4)}°  (${omega_best.toFixed(6)} rad)`);

  const obs = GROUND_TRUTH.filter(o => o.planet === planet);
  for (const o of obs) {
    const pred0 = planetXYZ(o.t_ms, planet.a, planet.ecc, planet.inc, 0, planet.RA);
    const predW = planetXYZ(o.t_ms, planet.a, planet.ecc, planet.inc, omega_best, planet.RA);
    const r = Math.sqrt(o.truth.x**2 + o.truth.y**2 + o.truth.z**2);
    const err0 = dist(pred0, o.truth) / r * 100;
    const errW = dist(predW, o.truth) / r * 100;
    console.log(`  ${o.label.split('@')[1].trim()}: error ω=0: ${err0.toFixed(3)}% → best ω: ${errW.toFixed(3)}%`);
  }
  console.log();
}

// --- Step 3: Also try solving for ecc alongside ω ---
console.log('=== Step 3: What if we also free eccentricity? ===\n');

function totalErrorEccOmega(planet, observations, ecc, omega) {
  return observations.reduce((sum, obs) => {
    if (obs.planet !== planet) return sum;
    const pred = planetXYZ(obs.t_ms, planet.a, ecc, planet.inc, omega, planet.RA);
    return sum + dist(pred, obs.truth) ** 2;
  }, 0);
}

for (const [name, planet] of [['Avalon', AVALON], ['Helion Prime', HELION]]) {
  // Grid search over ecc [0, 0.1] and omega [-π, π], then refine
  let best = { ecc: planet.ecc, omega: 0, err: Infinity };
  for (let ei = 0; ei <= 40; ei++) {
    const ecc = ei * 0.0025;
    for (let oi = 0; oi <= 72; oi++) {
      const omega = (oi / 72) * 2 * Math.PI - Math.PI;
      const err = totalErrorEccOmega(planet, GROUND_TRUTH.filter(o => o.planet === planet), ecc, omega);
      if (err < best.err) best = { ecc, omega, err };
    }
  }
  // Refine with smaller grid around best
  const ecc0 = best.ecc, om0 = best.omega;
  for (let ei = -20; ei <= 20; ei++) {
    const ecc = ecc0 + ei * 0.00005;
    if (ecc < 0 || ecc > 0.5) continue;
    for (let oi = -20; oi <= 20; oi++) {
      const omega = om0 + oi * (Math.PI / 360);
      const err = totalErrorEccOmega(planet, GROUND_TRUTH.filter(o => o.planet === planet), ecc, omega);
      if (err < best.err) best = { ecc, omega, err };
    }
  }
  const obs = GROUND_TRUTH.filter(o => o.planet === planet);
  console.log(`${name}: best-fit ecc = ${best.ecc.toFixed(5)} (FIO: ${planet.ecc.toFixed(5)}), ω = ${(best.omega*180/Math.PI).toFixed(2)}°`);
  for (const o of obs) {
    const predBest = planetXYZ(o.t_ms, planet.a, best.ecc, planet.inc, best.omega, planet.RA);
    const r = Math.sqrt(o.truth.x**2 + o.truth.y**2 + o.truth.z**2);
    const errBest = dist(predBest, o.truth) / r * 100;
    console.log(`  residual: ${errBest.toFixed(4)}%`);
  }
  console.log();
}
