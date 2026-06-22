# Flight Planner — Session Context (updated 2026-06-22)

## Current state (commit 8f11f88)

All core physics implemented and validated against real in-game export (AVI-047P1).
Arc distance is within ~1.5% of game. Time error ~1 min on a 1h43m leg.

---

## What's implemented

### 1. Planet positions — Kepler ephemeris

```javascript
const REFERENCE_TIME_S = 1451690603; // 2016-01-01 23:23:23 UTC (APEX bundle.js)
function worldTime(unixT) { return REFERENCE_TIME_S + (unixT - REFERENCE_TIME_S) * 20; }

function planetXYZ(unixT, a_m, ecc, inc, GM_wt) {
  const wt = worldTime(unixT);
  const n = Math.sqrt(GM_wt / (a_m ** 3));
  const Ma = ((n * wt) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const E = solveKepler(Ma, ecc);
  const x_orb = a_m * (Math.cos(E) - ecc);
  const y_orb = a_m * Math.sqrt(1 - ecc * ecc) * Math.sin(E);
  return { x: x_orb, y: y_orb * Math.cos(inc), z: y_orb * Math.sin(inc) };
}
```

- FIO `OrbitSemiMajorAxis` is in METRES
- GM from `systemstars.json` via `G_SI × star.Mass`
- `worldTime()` applies the 20× game speed multiplier — no separate conversion needed
- The z coordinate (from FIO inclination) is computed but the game ignores z for arc
- For STL arcs, use only x,y from this function

### 2. STL arc — Carlson elliptic integrals (SIGN FIX 2026-06-22)

The game's stlDistance = arc of a focal transfer ellipse (paper §8).
**The game uses 2D** — confirmed from AVI-047P1 export: `transferEllipse.center.z = 0`.

Key functions: `carlsonRF`, `carlsonRD`, `ellipticEIncomplete` (Carlson symmetric forms)

```javascript
function calculateSltDistance3D(Ox, Oy, Oz, Px, Py, Pz) {
  // rO, rP: radii from star; a = (rO+rP)/2
  // u: chord from O to P; û = unit chord; n̂ = rotate(û, +90°) [LEFT normal]
  // s, h: focal construction from focal-radius swap
  
  // CRITICAL sign convention (validated against game export):
  const starCross = -(Ox*e2x + Oy*e2y + Oz*e2z);
  const sign = starCross > 0 ? 1 : -1;   // starCross>0 → star on right → O' on LEFT (+)
  // OLD WRONG CODE was: sign = starCross <= 0 ? 1 : -1   ← caused ~12% error
  
  // arc = 2·a·E(|ΔE|/2, e_t²)
  // rank-one reduction when ΔE < 0: R = (1/3)·m·sin²(2ψ)
}
```

### 3. Rendezvous iteration

```
S = position of departure planet at departure time
tFlight = 2·M   // initial guess
repeat up to 25 times:
    P = position of destination planet at (departure + tFlight)
    slt = calculateSltDistance3D(S, P)
    newT = slt.chargedKm / (2·accel·M) + 2·M
    converge when |newT - tFlight| < 0.5 s
```

### 4. Flight duration formula (paper §6)

```
t [real-s] = d / (2 · accel · M) + 2 · M
```

No game-factor conversion — already wall-clock seconds.

### 5. TO/LDG atmospheric formula (paper §12.4)

```
d_TO  [km] = (R_m / 1000) × (0.1482 + 0.4521 × P^0.30)
d_LDG [km] = 926 × (R_m/1e6)^0.96 × (1+P)^(-0.42)
accel_atm = accel / 350.11
M_atm = sqrt(d / (13.71 × accel_atm))
t = M_atm × 8.855  [real-s]
```

R_m = FIO `Radius` (metres); P = FIO `Pressure` (atm).

### 6. FTL jump model (paper §12.1–12.3, §13.5)

```
t_jump   = A · e^(-β·ρ) · d_ftl
t_charge = c · ρ · (m-1)          [m = consecutive hops]
c        = (3/8) · reactorPower / chargeFactor
β        = κ · reactorPower, κ ≈ 4.4e-4
```

FP_SCALE = 12.0 (paper §12.5). Gateway: `t_gw = d_ftl × 1200 + 1220` s.

### 7. STL fuel

Fetches `/ship/ships/fuel/{user}` in parallel with ships.
Computes tank size: `Math.round(store.WeightCapacity / sfWeight)` for `STL_FUEL_STORE` stores.
`sfWeight` = SF item weight from `material_data.json`.

---

## Validation: AVI-047P1 game export (Avalon → Helion Prime)

**File:** `C:\Users\eoinc\OneDrive\ProsperousUniversePlanning\AVI-047P1 Export.txt`

Ground truth from game at unix 1782124375.470 s departure:

| Segment | Distance (km) | M | Duration (s) | Damage |
|---|---|---|---|---|
| TAKE_OFF (Avalon) | 4,552.49 | 42 | 368 | 0 |
| TRANSIT | 627,402,853.9 | 1257 | 6,212 | 0.1142% |
| LANDING (Helion Prime) | 2,954.48 | 34 | 296 | 0.01459% |
| **Total** | | 1333 | **6,876** | |

Ship accel (derived from game data): 627402854 / (2×1257×3698) = **67.47 km/s²**

Our formula vs game:
- With FIO positions: -1.557% arc error, ~58 s time error ← current
- With game's exact positions: +0.027% arc error ← formula is essentially correct

---

## Key facts to remember

- **FIO `OrbitSemiMajorAxis` is in METRES** (440,950,812,000 m for Avalon = 441 M km)
- **Game uses 2D** for STL arc (`transferEllipse.center.z = 0` in export)
- **System-level eccentricity**: game uses SAME ecc for all planets in a system.
  FIO stores per-planet ecc (different values). This causes ~1.5% arc error.
  AVI-047P1 export: VH-331 system ecc = 0.02290518156769219 for all planets.
- **The prograde sign**: `starCross > 0 → sign = +1` (O' on LEFT of chord = prograde)
- **HULL_PHYSICS calibrated accel** (70.55 for BP-HJQJ-2441) was wrong — it compensated
  for the old sign bug. Real accel ≈ 67.47 km/s² (thrust/mass × condition).

---

## Open items / known issues

### High priority
1. **Ship accel**: Remove HULL_PHYSICS calibrated table. Use FIO thrust/mass × condition.
   For BP-HJQJ-2441: theoretical accel × 0.97 condition ≈ 68.43 km/s² (close to 67.47).
2. **Eccentricity source**: FIO per-planet ecc causes 1.5% arc error. Could fix by
   reading system-level ecc from game exports or a different FIO endpoint. Low priority
   given small time impact (~1 min on 1h43m leg).

### Medium priority
3. **Damage formula**: Current formula ~16× too high vs APEX (2.141% vs 0.130%).
   No formula exists in any paper. Previous work started in `prun_ship_builder.html`.
   Ground truth from AVI-047P1: TRANSIT=0.1142%, LDG=0.01459%.
   Need empirical calibration — route distance + density + damage data points.
4. **Ship condition → accel**: 97% condition → 3% accel reduction. Currently hardcoded.

### Low priority
5. **FTL calibration**: A and β from paper estimates (±5%). Calibrate against APEX.
6. **Station support** (Hortus/HRT etc): no surface, no TO/LDG; need orbital position.

---

## Data sources

| Data | Source | Notes |
|---|---|---|
| Planet orbits | `planet_data.json` (FIO) | SMA in metres, ecc slightly off from game |
| Star masses | `systemstars.json` (FIO) | NaturalId field for lookup |
| Gateways | `gateways.json` | FTL lane data |
| Material weights | `material_data.json` | SF weight for fuel capacity |
| Ship data | FIO `/ship/ships/{user}` | Thrust, mass, reactors |
| Fuel stores | FIO `/ship/ships/fuel/{user}` | WeightCapacity for STL tank |
