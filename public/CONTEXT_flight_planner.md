# Flight Planner — Session Context (updated 2026-06-25)

## Current state (2026-06-25)

All core physics implemented and validated against real in-game exports.
Arc distance is within **0.03% of game** (was 1.5% before ephemeris fix).
Ephemeris source: Marcus's fitted orbital parameters (`public/ephemeris.json`, 4199 planets).

---

## What's implemented

### 1. Planet positions — Marcus's fitted ephemeris (IMPLEMENTED 2026-06-25)

```javascript
// ephemeris.json entry: [e, n, M0, peri_rad, p_km, ux, uy, uz, wx, wy, wz]
// n = mean motion (rad/s, game-speed = 20× astronomical)
// M0 = mean anomaly at Unix epoch (real seconds t=0)
// p_km = semilatus rectum in km
// u, w = orbital frame unit vectors (u = periapsis direction, w = prograde at periapsis)
function planetXYZFromEph(naturalId, unixT_s) {
  const [e, n, M0, peri, p_km, ux, uy, uz, wx, wy, wz] = _ephemeris[naturalId];
  const E  = solveKepler(M0 + n * unixT_s, e);
  const nu = 2 * Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2));
  const r  = p_km / (1 + e * Math.cos(nu));
  const th = peri + nu;
  const ct = r * Math.cos(th), st = r * Math.sin(th);
  return { x:(ct*ux+st*wx)*1000, y:(ct*uy+st*wy)*1000, z:(ct*uz+st*wz)*1000 }; // metres
}
```

- Positions returned in **metres** (Marcus's native unit is km, ×1000 for our arc formula)
- Source: `public/ephemeris.json` — 4199 planets, fitted by Marcus from game observations
- Falls back to old `planetXYZ` (FIO elements, ~1.5% error) for planets not in ephemeris
- `getPlanetPos(pl, unixT, GM)` wraps both: tries ephemeris first, then FIO fallback

**Validation against AVI-047P1 exports:**

| Export | Game arc (km) | Our arc (km) | Error |
|---|---|---|---|
| Jun 22 (627M km) | 627,402,854 | 627,614,000 | +0.034% |
| Jun 23 1956 (563M km) | 563,971,100 | 564,146,307 | +0.031% |
| Jun 23 2045 (561M km) | 561,745,068 | 561,902,000 | +0.028% |

0.027% floor is the Carlson arc formula's own error (confirmed with exact positions).
Previous FIO-only ephemeris gave ~1.5% arc error (50× worse).

**Ephemeris internals (for reference/debugging):**
- Orbital frame: u ≈ (0,−1,0) for most planets; w ≈ (−cos inc, 0, −sin inc)
- peri_angle ≈ π (180°) for ~95% of planets; per-planet for the rest
- n is already 20× the astronomical value — pass real Unix seconds directly, no worldTime()
- Old worldTime()/planetXYZ() still present as fallback but no longer used for known planets

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

**Additional exports (June 23, same route):**

`AVI-047P1 Export 23-06-2026 1956.txt` — departure 1782208470882 ms:

| Segment | Distance (km) | M | Notes |
|---|---|---|---|
| TAKE_OFF (Avalon) | 4,552.49 | 42 | identical to June 22 |
| TRANSIT | 563,971,100 | 1258 | FIO positions give ~556M km (-1.4%) |
| LANDING (Helion Prime) | 2,563.69 | 32 | approach altitude 696 km |

`AVI-047P1 Export 23-06-2026 2045.txt` — departure 1782211512136 ms:

| Segment | Distance (km) | M | Notes |
|---|---|---|---|
| TAKE_OFF (Avalon) | 4,552.49 | 42 | |
| TRANSIT | 561,745,068 | 1257 | |
| LANDING (Helion Prime) | 2,784.84 | 33 | approach altitude 756 km |

LDG formula median for Helion Prime = 3,151 km. Actual across 3 flights: 2,954 / 2,564 / 2,785 km.
All below median — consistent with fixed below-average base tile. ±15% note shown in tool.

---

## Key facts to remember

- **Planet positions use Marcus's ephemeris** (`ephemeris.json`, 4199 planets, 0.03% arc error).
  `planetXYZFromEph(naturalId, unixT_s)` returns metres; takes real Unix seconds directly.
  Old `planetXYZ` / `worldTime` are retained as fallback for ~377 planets not in the ephemeris.
- **Mixed-frame guard**: ephemeris and FIO use incompatible coordinate frames (different Ω, ω).
  `stlRendezvous` detects when one planet is missing from the ephemeris and falls back to FIO
  for BOTH planets, keeping a consistent frame. Result carries `approx: true` when this happens,
  shown as `~` in the quick display and `(~1.5% accuracy)` in the route breakdown.
- **14 systems have partial ephemeris coverage** (some planets in, some not). Known cases include
  ZV-307c (Hephaestus), OT-189a (Mayer), UV-351a, KW-688c, XH-594b, LS-300c.
- **Game uses 2D** for STL arc (`transferEllipse.center.z = 0` in export); our formula is 3D
  and gives the same result to 0.03%.
- **ORBIT blocks in flight exports are approach/parking orbit parameters** (per-flight low orbit),
  NOT heliocentric elements. Do not use them to infer ecc/inc/ω.
- **The prograde sign**: `starCross > 0 → sign = +1` (O' on LEFT of chord = prograde)
- **HULL_PHYSICS calibrated accel** (70.55 for BP-HJQJ-2441) was wrong — it compensated
  for the old sign bug. Real accel ≈ 67.47 km/s² (thrust/mass × condition).

---

## Open items / known issues

### High priority
1. **Ship accel**: Remove HULL_PHYSICS calibrated table. Use FIO thrust/mass × condition.
   For BP-HJQJ-2441: theoretical accel × 0.97 condition ≈ 68.43 km/s² (close to 67.47).
2. **Ephemeris (IMPLEMENTED 2026-06-25)**: Replaced FIO-based `planetXYZ` with Marcus's
   fitted ephemeris (`ephemeris.json`, 4199 planets). Arc error: 1.5% → 0.03%.
   Marcus's u/w vectors encode the CW orbit + Ω=-90° + per-planet ω implicitly.
   `ephemeris_check.js` in repo root documents the analysis that led here.

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
| Planet orbits | `ephemeris.json` (Marcus) | 4199 planets, 0.03% arc accuracy; fallback: `planet_data.json` (FIO, ~1.5%) |
| Star masses | `systemstars.json` (FIO) | NaturalId field for lookup |
| Gateways | `gateways.json` | FTL lane data |
| Material weights | `material_data.json` | SF weight for fuel capacity |
| Ship data | FIO `/ship/ships/{user}` | Thrust, mass, reactors |
| Fuel stores | FIO `/ship/ships/fuel/{user}` | WeightCapacity for STL tank |
