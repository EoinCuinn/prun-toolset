# Flight Planner — Session Context (2026-06-21)

## What was built this session

Implemented the Josh Glass paper (June 2026) physics into `prun_flight_planner.html`.

### 1. TO/LDG atmospheric formula (paper §12.4)

```
d_TO  [km] = (R_m / 1000) × (0.1482 + 0.4521 × P^0.30)    increases with pressure
d_LDG [km] = 926 × (R_m/1e6)^0.96 × (1+P)^(-0.42)         decreases with pressure
accel_atm = accel / 350.11
M_atm = sqrt(d / (13.71 × accel_atm))                       server-set fuel tier
t = M_atm × 8.855  [real-s]
```

Replaced the old 886s (14m46s) placeholder. Avalon TO now ~6m, Helion Prime LDG now ~5m.

### 2. GM for all 698 systems

`systemstars.json` already had `Mass` (kg) — one line in `loadData()` now fills `_sysGM`:

```javascript
if (s.Mass) _sysGM[s.SystemId] = G_SI * s.Mass;  // G_SI = 6.6743e-11
```

Removed the hardcoded `GM_BY_SYSTEM_NAT` table. All systems exact.

### 3. STL rendezvous arc solver (paper §8) — MAIN WORK

The game's `stlDistance` is the **arc of a focal transfer ellipse**, NOT a chord or Hohmann arc.

#### Transfer ellipse construction (Prop 8.2)
- `a_t = (r_S + r_P) / 2`  (focal semi-major axis; star O at focus)
- Second focus O' via focal-radius swap: `|O'S| = r_P`, `|O'P| = r_S`
- **Prograde O' criterion**: O' on the opposite side of chord SP from the star
  - `starCross = -ux·Sy + uy·Sx`
  - `starCross ≤ 0` → O' offset in `+(−uy, ux)` direction
  - `starCross > 0` → O' offset in `−(−uy, ux)` direction
  - (Wrong sign picks the retrograde path — returns shorter but physically incorrect arc)

#### Arc integral (eq 10)
200-point midpoint rule over `sqrt(at²·sin²E + bt²·cos²E) dE`, taking the shorter direction.

#### Rendezvous iteration
```
S = planetXY(now, a_origin, e_origin, GM)
tFlight = 2·M   // initial guess
for 25 iterations:
    P = planetXY(now + tFlight, a_dest, e_dest, GM)
    arc = transferArcKm(S.x, S.y, P.x, P.y)
    newT = arc / (2·accel·M) + 2·M
    if |newT - tFlight| < 0.5: converged
    tFlight = newT
```

Converges in ~3 iterations.

#### Validation against APEX
Avalon (VH-331g) → Helion Prime (VH-331d), BP-HJQJ-2441 ship, M=1256:
- Our planner: **715 M km, 1h49m** total **2h**
- APEX simultaneous: 684,626,153 km, 1h49m, total 2h0m27s

**Time matches exactly. Distance is ~30 M km (4.5%) high.**

---

## Open issue: 30 M km arc discrepancy

The arc shows ~715 M km while APEX reports ~685 M km at approximately the same time.
The TIME is correct (1h49m) because the calibrated accel (70.55 km/s²) absorbs the arc error —
the calibration was derived from actual game stlDistance values, so it already "knows" about
any systematic offset in our Kepler positions.

Hypotheses to investigate:
1. **Epoch difference**: APEX screenshot taken minutes before our test run? Helion Prime moves ~2.7°/hour, arc changes ~5 M km/hour. 6-hour lag → 30 M km. Verify by comparing simultaneously.
2. **GM slightly off**: `G × star.Mass` from FIO vs game's internal GM. Even 1% error over 10 years accumulates to large positional error. But positions look ~correct, so GM must be very close.
3. **Arc computation**: algorithm follows paper §8 exactly; validated against Hohmann formula (opposite-side case: 707 M km ✓). 2D vs 3D: paper §8.4 says 3D ≠ 2D by several percent, but §8.3 Remark says server uses 2D for in-system flights. Should be fine for VH-331.
4. **Reference time**: `REFERENCE_TIME_S = 1451690603`. If off by seconds, planet positions drift over 10 years. Paper says M₀=0 at worldTime=0, hardcoded in APEX bundle.js.

**Next session**: run both tools simultaneously, log exact timestamps, and narrow down the source.

---

## Key functions added

| Function | Purpose |
|---|---|
| `transferArcKm(Sx, Sy, Px, Py)` | Transfer ellipse arc km, prograde O' |
| `stlRendezvous(pl1, pl2, GM, accel, M, now)` | Iterative rendezvous solver |
| `atmLeg(R_m, P, accel, which)` | TO/LDG atmospheric leg |
| `sysGM(sysId)` | GM from `_sysGM` map (all 698 systems) |

## Ship accel note

For calibrated hulls (`HULL_PHYSICS`), the stored `accel` (e.g. 70.55 for BP-HJQJ-2441) is used.
This was derived from actual in-game flights and implicitly corrects for our ~4.5% arc offset.
Using raw `thrust/mass` (67.47 for a loaded ship) gives physically correct accel but causes
~3 min time error because the arc error is no longer compensated. Don't change this until
the arc discrepancy is resolved.
