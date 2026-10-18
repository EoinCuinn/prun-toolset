# Flight Planner — Technical Context (updated 2026-10-18)

Technical reference for `public/prun_flight_planner.html`. For the phase-by-phase
history, gates, and running revision log, see `prun-flight-planner-roadmap.html` —
that is the status source of truth; this file is the "how it works" companion.

## Current state (2026-10-18)

Read-only planner. Enter origin, destination, and a ship (real fleet via FIO Swagger,
or a hypothetical build from component dropdowns) → per-leg flight time, fuel, and a
hull-damage projection with condition alerts.

- **Flight time / distance:** solved and validated. Arc within ~0.03% of game (Marcus's
  fitted ephemeris). STL rendezvous, departure/approach arcs, FTL jump + gateway all live.
- **Gate geometry (2026-10-18):** planet gates are **0.5 AU** from the planet; station
  gates are **0.15 AU** from the station. Direction from the system-map positions.
- **Departure distance (2026-10-18):** the game builds the transfer ellipse in the
  **z=0 plane** and bills its **charged (rank-one reduced)** distance — not the 3-D arc
  and not the straight-line chord. Matches 39 captured departures to 0.03–0.55% on most
  cases (worst MOR 3.7%).
- **Fuel:** well-leg TO/LND exact (A3/B3/A4). **DEP fuel = `M × flow/0.015`; APPROACH
  fuel = loaded loadout units × 0.491 × fuf; APPROACH is timed at its fuel-derived M.**
  Test11: 779.6 vs game 779 STL, ETA 6h20m57s vs 6h20m55s. Full `committed` split for
  arbitrary loads/fuf is still open.
- **FTL (C, 2026-10-18):** blueprint-anchored `J(1)`; measured β; emitter-based charge
  time; charge fuel; slider floor `E/P`. A capture-calibrated `j1` anchor overrides a
  rounded panel `ftlMaxSpeed` (BP-FYSQ-7703: 1023.54 s/pc, effective 3.517 pc/h). See §6.
- **Empty mass & totalVolume (Open Mass, 2026-07-18):** derived from the loadout, not a
  fitted aggregate. Volume 86/86 within 1%, mass 82/86 within 1%.
- **Damage model:** D model (Marcus 2026-10-12, committed 2026-10-18) — jump, charge,
  take-off, landing, and DEP/APP/TRANSIT with solar flux; see §8. Test11 damage 0.179%
  vs game 0.169% (0.010 pp residual).
- **UI (2026-09-19):** hypothetical-mode shielding is five mutually-exclusive dropdowns
  (was a checkbox grid); per-part count selectors removed (one of each part). Commit 68a9208.

---

## What's implemented

### 1. Planet positions — Marcus's fitted ephemeris (2026-06-25)

`planetXYZFromEph(naturalId, unixT_s)` reads `public/ephemeris.json` (4199 planets),
entry `[e, n, M0, peri_rad, p_km, ux,uy,uz, wx,wy,wz]`. `n` is already game-speed
(20× astronomical) — pass real Unix seconds directly, no `worldTime()`. Returns metres.
Arc error ~0.03% (was ~1.5% on FIO elements). ~377 planets not in the ephemeris fall back
to the old FIO `planetXYZ`; a **mixed-frame guard** in `stlRendezvous` drops BOTH endpoints
to FIO when either is missing (incompatible frames), flagging the result `approx: true` (`~`).

### 2. STL arc — Carlson elliptic integrals

`calculateSltDistance3D()` — focal transfer-ellipse arc via `carlsonRF` / `carlsonRD` /
`ellipticEIncomplete`. Game uses 2D (`transferEllipse.center.z = 0`); our 3D form matches to
0.03%. Critical sign: `starCross = -(O·e2)`, `sign = starCross > 0 ? 1 : -1` (star on right →
prograde O' on left). Rank-one reduction when ΔE < 0.

### 3. Rendezvous + flight duration

`stlRendezvous` iterates position→distance→time to convergence (≤25 iters, <0.5 s).
Duration: `t [real-s] = d / (2·accel·M) + 2·M` (paper §6, already wall-clock).

### 4. TO / LND distance

- **Take-off:** `d_TO [km] = (R_m/1000) × (0.15 + 0.45 × P^log10(2))` (A3, exact).
- **Landing (REWRITTEN 2026-07-14, commit 34ef374; A4 2026-10-18):** landing distance is a
  per-planet constant times a missionId-seeded draw — `d = k·(13 + 4·r)`,
  `r = Random(hash(missionId)).nextDouble()`, so `dmin=13k`, `dmax=17k`, band **±2/15 = ±13.3%**.
  Mean (missionId unknown) = `15k = planet_term = radius_km × pressureFactor`. R²=1.000000
  across 4482 planets (Marcus). The planner shows `planet_term ± 13.3%`. The band is
  **irreducible** for a read-only tool: the client mints the missionId with
  `crypto.getRandomValues()` (CSPRNG, unsteerable — bundle disassembly 2026-07-16).
  All old per-engine landing-ratio tables removed.
- Atmospheric physics constants (used by fuel): `accel_atm = accel/350.11`,
  `M_atm = sqrt(d / (13.71·accel_atm))`.

### 4b. Gate geometry & departure transfer (2026-10-18)

- **Planet gates:** 0.5 AU (74,798,935 km) from the planet.
- **Station gates:** 0.15 AU (22,439,680.6 km) from the station.
- Direction is the system-map direction toward the neighboring system; that part was already
  correct. The old code used 0.5 AU for both, which made station departures ~3.3× too long.
- **Departure distance:** project both endpoints to **z=0**, run `calculateSltDistance3D`, and
  use **`chargedKm`** (the rank-one reduced distance the game bills). Do **not** use the 3-D
  arc and do not use the straight-line chord. Captured Test4 HRT: 22.375M game vs 22.383M
  model; Test6 HRT: 18.175M vs 18.276M; OF-443b 54.470M vs 54.577M; MOR 9.829M vs 9.464M.
  Across 39 captured departures most match to 0.03–0.55%; MOR is the worst at 3.7%.
- **Approach** still uses the gate→planet/station rendezvous in 3-D; B5 z=0 projection for
  APPROACH/TRANSIT remains open (Test11 APP +0.43%).

### 5. Fuel

- **TO / LND fuel (solved 2026-07-14, closed-form 2026-07-15):**
  `fuel = k · flow · √(dist / accel_eff)`, where `accel_eff = min(actual accel, maxGFactor × 9.80665)`
  (the **g-cap** — only Hyperthrust exceeds the 16 g / 157 m/s² cap). `k = 336.9`, derived
  (not fitted): `k = (4/0.06) × √(350.11/13.71)`. Reproduces all 5 test engines to ~1%. The
  planner caps accel in `shipPhysics`; Real Fleet now fills `maxGFactor` from
  `public/blueprint_maxg.json` (88 entries), and unknown blueprints fall back to no clamp.
- **DEP fuel (B2/B3, 2026-10-18):** `fuel = M_dep × (stlFlowRate / 0.015)`. At the reference
  flow 0.015 this is just `M`; at the BFT's 0.03 it is `2M`. Validated: Test4 M=168 → 336;
  Test6/7 M=152 → 303–304; Test11 304 vs game 304. The old preview-derived
  `13.34·fuf·stlFuel/a` cap is retired.
- **APPROACH fuel (B2/B3, 2026-10-18):** `loaded_STL_units (loadout slider) × 0.491 × fuf`.
  Use the **flight loadout slider**, not FIO storage and not tank capacity. Test8: storage
  2,130 u, slider 1,750 u; game burns 430 = 1,750 × 0.491 × 0.5. The old tank-capacity form
  gave exactly 2×. APPROACH is timed at `M_app = appFuel / (stlFlowRate/0.015)` using
  `t = d/(2·a·M) + 2M` when `d > 4aM²`; Test11 21m42s vs game 21m38s.
- **Fuel usage slider:** TO / LND / JUMP are invariant to `fuelUsageFactor`; DEP and APPROACH
  use the laws above. Old per-leg fuel slider removed; `fuelUsageFactor` input added
  (default 0.50, range 0.10–1.00).
- **Still open:** the full Marcus `wells → rem → dep/app` split with a general `committed`
  budget for arbitrary fuel-load/usage combinations. The current formulas reproduce the
  validated BFT flights.
- **Same-system TRANSIT fuel:** `(tank − TO − LND) × fuf`, unchanged (validated 2026-07-11).

### 6. FTL jump + gateway — calibrated (C, 2026-10-18)

`J(1) = 3600 / ftlMaxSpeed` (pc/h); `J(ρ) = J(1)·e^(β(1−ρ))`. Measured β: RCT 1.123,
QCR 0.929, HPR 2.002, HYR 2.976. Charge time `(3/8)·P·ρ/f` per charge (the E/P floor
gives `(3/8)·E/f`), counts jumps−1;
charge fuel `⌊P·ρ·pc/333⌋` FF per jump, first charge on departure. `E = 100·SFE +
175·MFE + 300·LFE`; slider floor `E/P`. 88 blueprint entries (85 with FTL) in
`public/blueprint_ftl.json`; unknown/hypothetical ships use the C3 hull-volume fit and
are flagged. `FP_SCALE = 12.0`. Gateway: `t_gw = d_ftl × 1200 + 1220` s (3 pc/hr,
ship-independent); gateway damage unknown.

**Capture-calibrated `J(1)` anchor (2026-10-18):** the in-game panel rounds `ftlMaxSpeed`
to two decimals, so `BP-FYSQ-7703`'s displayed 3.50 pc/h is really ~3.517. Its
`blueprint_ftl.json` entry now carries `"j1": 1023.54` s/pc, preferred over
`3600/vmax`; this made the Test11 jump time exactly 5h44m22s. Other blueprints use
their stored `vmax` until a capture shows drift.

### 7. Empty mass & totalVolume — "Open Mass" (2026-07-18, commit 7c74e80)

Hypothetical empty mass is derived from the twelve selectable components, not a fitted number:
- **`operatingEmptyMass = Σ(component BOM weight × count)`** over the full bill of material,
  including auto-added parts. Exact on 87/87 captured blueprints.
- **`totalVolume = 438 + 1.05 × cargo_capM3 + engineΔ + stlTankΔ + reactorΔ + ftlTankΔ`.** Cargo
  drives it by m³ capacity, not tonnage. It is a fixed point (the game sizes structure *from*
  volume, and that structure then occupies volume) — NOT the sum of component volumes.
- Downstream: `plates = round(0.535 · V^0.655)`, `SSC = round(0.0478 · V)`, crew quarters by
  volume band, command bridge by FTL-reactor tier, FTL field controller if an FTL reactor is fitted.
- Only 5 of the 12 fields move volume: hull-plate type (count is volume-driven, identical across
  types), engine, STL tank, reactor, FTL tank. Shielding / drone / seats have ZERO volume effect.
- ⚠ **Method note:** a regression over the five volume fields returns high R² and *wrong*
  coefficients — the fields co-vary in any natural corpus. Every delta was measured from CLEAN
  one-field-change blueprint pairs.

### 8. Damage model — D (Marcus 2026-10-12; committed 2026-10-18)

Every channel is a fraction of condition multiplied by `h = 1 − SHIELDING_GENERAL`.
Shielding resolved per ship: real fleet → `BLUEPRINT_SHIELDING` (5 known blueprints; unknown
→ h=1); hypothetical → summed `SHIELDING_FACTORS` over the hull plate + selected damage/repair
dropdowns (general is additive). Heat/whipple/radiation plate factors are not used by D.

- **Jump:** `h·1e-5·pc` (no ρ or reactor dependence).
- **Charge:** `h·5e-4·(ρ − E/P)` per lane jump; E = emitter power; snapshot fallback when unknown.
- **Take-off:** `h·T·G(g)`.
- **Landing:** `h·T·[G(g) + min(4e-7·P, 1e-5)]`.
- **DEP / APP / TRANSIT:** `h·d·[2e-12 + 5e-12·ρ + 2e-22·√(F1·F2)]`, F =
  `Luminosity·3.0605e25/r(km)²` at the 3-D start/end points.
- `G(g) = 1.5e-5 + 6e-5·(0.25−g)` for g<0.25; `1.5e-5 + 6e-6·(g−2.5)` for g>2.5; else 0.
- **Gateway:** unknown; retains `GATEWAY_DMG = 5.247e-5` per hop (estimate).
- **Condition feedback:** `projected = current − tripDamage`; alerts amber <80%, red <50%.
- NL-534 validation: predicted/observed 0.91–0.93 on the four radial legs; the a→h control
  (same distance, inward dive) matches within 1.7%.
- Test11 (2026-10-18, HRT→OZ-189a BFT): planner 0.179% vs game 0.169% (0.010 pp residual).
  Treat that residual as a re-check item, not a fitted constant.

### 9. Radiation / solar flux — implemented in D

The D transit term includes solar flux `F = Luminosity·3.0605e25/r(km)²` at the 3-D endpoints.
This supersedes the earlier path-integration approach. The anti-rad *plate* is confirmed
non-functional in the captures, consistent with D using only `h = 1 − SHIELDING_GENERAL`.
`research/radiation/` is retained as validation (NL-534 a→h control, WX-827 meteor-dominated
transits).

### 10. UI — dual mode + shielding dropdowns (2026-09-19, commit 68a9208)

- **Real Fleet:** FIO Swagger `api.fnar.net/ships` (header `FIOAPIKey <key>`); live fuel loads via
  `api.fnar.net/storage`. OEM / Thrust / Mass / Condition / BlueprintNaturalId.
- **Hypothetical:** component dropdowns → mass + accel from selections. Shielding is now **five
  mutually-exclusive dropdowns** (Heat / Whipple / Stability / Radiation / Self-repair drone hub),
  full names with ticker in parens, ascending capability. **Per-part count selectors removed**
  (engQty hardwired to 1). The three readers (`hypoSelections`, `hypoLookupKey`, `rebuildHypo`
  shielding sum) read the dropdown values; regression-identical to the old checkbox grid.

---

## Key facts to remember

- **Distance, not time, is the base variable** for damage (within-system CV: 1.9% distance vs
  22.6% time).
- **G-cap is load-bearing:** `accelMax = min(thrust/totalMass, maxGFactor × 9.80665)`. Hull
  G-factors LHP=10 BHP=8 RHP=11 HHP=13 AHP=15; seats additive (BGS +5, AGS +12). It solved
  Hyperthrust fuel and matters for accel cross-checks.
- **In-flight mass = OEM + 0.06×STL_units + 0.05×FTL_units + payload.** FIO `Acceleration` is
  thrust/loaded-mass (×condition), not thrust/OEM — fueled ships read ~10% low on FIO accel.
- **±13.3% landing band is irreducible** for a read-only tool (CSPRNG missionId). Fixed base-tile
  hypothesis REFUTED (same ship + same base repeats land at different distances).
- **Fuel is allocated first, then timed:** DEP fuel = `M × flow/0.015`; APPROACH fuel =
  `loaded loadout units × 0.491 × fuf`; APPROACH M = `appFuel / (flow/0.015)`. Test11:
  6h20m57s vs game 6h20m55s; 779.6 vs 779 STL.
- **The game bills z=0 charged distance, not the 3-D arc or chord:** departure endpoints
  are projected to z=0 and `calculateSltDistance3D().chargedKm` is used. Station gates are
  0.15 AU; planet gates 0.5 AU.
- **Read-only, no keys committed** — FIO key/username in localStorage (`prun_apikey` /
  `prun_fiouser`); nothing else persists.

---

## Open items / known issues

1. **Full B2/B3 `committed` split** — DEP/APP fuel and timing are validated on the BFT route,
   but the general `wells → rem → dep/app` split for arbitrary fuel-load/usage combinations is
   not implemented. Needs a slider sweep on the same route.
2. **B5 approach/transit z=0** — DEP is fixed; APPROACH and same-system TRANSIT still run in
   3-D (Test11 APP +0.43%). Project them to z=0 before `calculateSltDistance3D`.
3. **Damage residual** — Test11 0.179% vs 0.169%; re-check D on other ships/routes before
   fitting anything.
4. **FTL `j1` audit** — BP-FYSQ-7703 is calibrated (1023.54 s/pc); other blueprints use their
   stored `vmax`. Add a `j1` anchor if captured jump times drift.
5. **Gateway damage** — still unknown; retains the `GATEWAY_DMG = 5.247e-5` estimate.
6. **Exact plate / SSC rounding rule** — counts reproduced to ±1 only; the sole remaining
   empty-mass error source (4 ships at 1.0–1.35%). Needs a size-ladder sweep.
7. **Vortex drive** — unmodelled (1 sample, BP-CLNY-0000); outside the twelve selectable fields.
8. **Ship Builder ↔ Flight Planner** — to share one component/physics model (planned).
9. **Dead code** — `engineFromThrust()` / `engineType` (landing rewrite) and
   `approachComputedMax()` (B2/B3) are now unused; safe to delete.

---

## Data sources

| Data | Source | Notes |
|---|---|---|
| Planet orbits | `ephemeris.json` (Marcus) | 4199 planets, ~0.03% arc; fallback `planet_data.json` (FIO, ~1.5%) |
| Star mass / density | `systemstars.json` (SAGANAKI via FIO) | meteoroid density + luminosity; API field is `MeteroidDensity` (one 'o') |
| Gateways | `gateways.json` | FTL lane data |
| Material weights | `material_data.json` | fuel-store capacity |
| Ship data | FIO Swagger `api.fnar.net/ships` | thrust, mass, OEM, condition, blueprint id |
| Fuel stores | FIO `api.fnar.net/storage` | live STL/FTL fuel loads; **the flight uses the loadout slider, not this total** |
| Blueprint FTL | `blueprint_ftl.json` | 88 entries; optional `j1` (s/pc) overrides a rounded panel `vmax` |
| Blueprint max-G | `blueprint_maxg.json` | 88 entries; real-fleet G-cap |
| Component / BOM | `COMPONENT_DATA` in-file + `BLUEPRINT_BLUEPRINTS` captures | Open Mass ground truth |
| Flight captures | `prun-flight-capture/captures/` | 39 departure geometries; Test4/6/7/8/11 validation |

## Pointers

- `prun-flight-planner-roadmap.html` — master roadmap + running revision log (status source of truth).
- `research/` — reverse-engineering write-ups: `landing/` (seed/PRNG), `radiation/`, plus openmass notes.
- Captures: `prun-flight-capture` (private) / `prun-flight-capture-public` — MV3 extension + pipeline.
- Credits (load-bearing to the models): Marcus Licinius Crassus (flight dynamics, ephemeris),
  Taiyi Bureau (TO/LND distance), Raylu (pruncalc), [OOG] Aem | SR (radiation + landing-damage data),
  SAGANAKI (star/system data).
