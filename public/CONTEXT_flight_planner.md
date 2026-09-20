# Flight Planner — Technical Context (updated 2026-09-21)

Technical reference for `public/prun_flight_planner.html`. For the phase-by-phase
history, gates, and running revision log, see `prun-flight-planner-roadmap.html` —
that is the status source of truth; this file is the "how it works" companion.

## Current state (2026-09-21)

Read-only planner. Enter origin, destination, and a ship (real fleet via FIO Swagger,
or a hypothetical build from component dropdowns) → per-leg flight time, fuel, and a
(provisional) hull-damage projection with condition alerts.

- **Flight time / distance:** solved and validated. Arc within ~0.03% of game (Marcus's
  fitted ephemeris). STL rendezvous, departure/approach arcs, FTL jump + gateway all live.
- **Fuel:** TO / LND / APPROACH / TRANSIT solved and confirmed in-browser. **DEP fuel is
  ~6% low — open bug.**
- **Empty mass & totalVolume (Open Mass, 2026-07-18):** derived from the loadout, not a
  fitted aggregate. Volume 86/86 within 1%, mass 82/86 within 1%.
- **Damage model:** implemented but **REOPENED 2026-07-10 — treat every damage number as
  provisional** until re-confirmed. Meteor v5 committed; landing damage fitted; radiation
  known but **not yet implemented**.
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

- **Take-off:** `d_TO [km] = (R_m/1000) × (0.1482 + 0.4521 × P^0.30)`.
- **Landing (REWRITTEN 2026-07-14, commit 34ef374):** landing distance is a per-planet
  constant times a missionId-seeded draw — `d = k·(13 + 4·r)`, `r = Random(hash(missionId)).nextDouble()`,
  so `dmin=13k`, `dmax=17k`, band **±2/15 ≈ ±15%**. Mean (missionId unknown) = `15k = planet_term
  = radius_km × pressureFactor`. R²=1.000000 across 4482 planets (Marcus). The planner shows
  `planet_term ± 15%`. The ±15% is **irreducible** for a read-only tool: the client mints the
  missionId with `crypto.getRandomValues()` (CSPRNG, unsteerable — bundle disassembly 2026-07-16).
  All old per-engine landing-ratio tables removed.
- Atmospheric physics constants (used by fuel): `accel_atm = accel/350.11`,
  `M_atm = sqrt(d / (13.71·accel_atm))`.

### 5. Fuel

- **TO / LND fuel (solved 2026-07-14, closed-form 2026-07-15):**
  `fuel = k · flow · √(dist / accel_eff)`, where `accel_eff = min(actual accel, maxGFactor × 9.80665)`
  (the **g-cap** — only Hyperthrust exceeds the 16 g / 157 m/s² cap). `k = 336.9`, derived
  (not fitted): `k = (4/0.06) × √(350.11/13.71)`. Reproduces all 5 test engines to ~1%. The
  planner already caps accel in `shipPhysics`, so Hypothetical mode is correct; Real Fleet has
  `maxGFactor` null → cap skipped (no-op for normal fleets).
- **APPROACH fuel:** `STL_tank_capacity × 0.491 × fuelUsageFactor` (confirmed across 3 tank sizes).
- **Fuel usage slider:** TO / LND / JUMP are invariant to `fuelUsageFactor`; DEP scales linearly
  up to a route-dependent cap; APPROACH as above. Old per-leg fuel slider removed;
  `fuelUsageFactor` input added (default 0.50, range 0.10–1.00).
- **DEP fuel — OPEN BUG:** planner underpredicts the DEPARTURE segment by ~6%; the departure
  thrust term is not yet fitted. DEP leg only; TO / LND / TRANSIT confirmed.

### 6. FTL jump + gateway

`t_jump = A · e^(-β·ρ) · d_ftl`; `t_charge = c · ρ · (hops-1)`; `c = (3/8)·reactorPower/chargeFactor`,
`β = κ·reactorPower` (κ≈4.4e-4). `FP_SCALE = 12.0`. Gateway: `t_gw = d_ftl × 1200 + 1220` s
(3 pc/hr, ship-independent). `A`/`β` are paper estimates (±5%), not yet calibrated against APEX.

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

### 8. Damage model — implemented, REOPENED 2026-07-10 (provisional)

`applyShield(base, factor) = base × (1 − factor)`. Shielding resolved per ship: real fleet →
`BLUEPRINT_SHIELDING` (4 known blueprints); hypothetical → summed `SHIELDING_FACTORS` over the
hull plate + selected shielding dropdowns (general is additive).

- **Meteor (v5, commit 207845e):** `k = 7.1692e-6`, density-dependent exponent
  `p(ρ) = 0.683 + 0.223·log₁₀(ρ)`. Star-type multipliers removed (F=G=K=M=1.000). 19 systems,
  R²=0.9989. Distance = charged transit distance (chargedKm ÷ 1e6).
- **Landing (fitted 2026-07-05):** `1.1322e-4 × dist^0.4934 × accel^−0.9441 × pressure^0.9288`,
  R²=0.989. Higher accel = less damage (exposure time). Distance input is `planet_term ± 15%`,
  so that uncertainty propagates. Pressure law saturates at extremes (MG-197e ~2× over).
- **Charge:** `CHARGE_DMG = {2000: 6.875e-6, 2400: 7.133e-5}` (QCR / RCT).
- **Gateway:** `GATEWAY_DMG = 5.247e-5` per hop — estimated from 8 samples on one ship.
- **Condition feedback:** `projected = current − tripDamage`; alerts amber <80%, red <50%.
- ⚠ The whole model + all mitigation was reopened on new player information. Meteor v5 believed
  still correct but to be re-cross-checked; landing/charge/gateway all provisional.

### 9. Radiation — known, NOT implemented

Formula (Aem, KQ-451 O-type runs): with advanced anti-rad shielding `%/Mkm = 0.0224 × AU⁻²`;
without `0.0734 × AU⁻²`; floor ~0.0002 %/Mkm; ~70% reduction for advanced anti-rad. Relevant for
O/B systems and inner-planet routes. **Not in the planner yet.** Note: the anti-rad *plate* is
confirmed non-functional in standard cases (do not credit it with radiation mitigation).

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
- **±15% landing band is irreducible** for a read-only tool (CSPRNG missionId). Fixed base-tile
  hypothesis REFUTED (same ship + same base repeats land at different distances).
- **Read-only, no keys committed** — FIO key/username in localStorage (`prun_apikey` /
  `prun_fiouser`); nothing else persists.

---

## Open items / known issues

1. **DEP fuel ~6% low** — departure thrust term not fitted. (High priority — the one confirmed
   fuel bug.)
2. **Damage model reopened** — re-cross-check meteor v5, landing, charge, gateway under the
   improved capture pipeline before treating any damage number as final.
3. **Radiation damage** — formula known, not yet implemented in the planner.
4. **Exact plate / SSC rounding rule** — counts reproduced to ±1 only; the sole remaining
   empty-mass error source (4 ships at 1.0–1.35%). Needs a size-ladder sweep.
5. **Vortex drive** — unmodelled (1 sample, BP-CLNY-0000); outside the twelve selectable fields.
6. **FTL A/β calibration** — paper estimates (±5%); calibrate against APEX.
7. **Ship Builder ↔ Flight Planner** — to share one component/physics model (planned).
8. **Dead code** — `engineFromThrust()` and `engineType` assignments are unused since the landing
   rewrite; safe to delete (line numbers shifted by the 2026-09-19 UI edit).

---

## Data sources

| Data | Source | Notes |
|---|---|---|
| Planet orbits | `ephemeris.json` (Marcus) | 4199 planets, ~0.03% arc; fallback `planet_data.json` (FIO, ~1.5%) |
| Star mass / density | `systemstars.json` (SAGANAKI via FIO) | meteoroid density + luminosity; API field is `MeteroidDensity` (one 'o') |
| Gateways | `gateways.json` | FTL lane data |
| Material weights | `material_data.json` | fuel-store capacity |
| Ship data | FIO Swagger `api.fnar.net/ships` | thrust, mass, OEM, condition, blueprint id |
| Fuel stores | FIO `api.fnar.net/storage` | live STL/FTL fuel loads |
| Component / BOM | `COMPONENT_DATA` in-file + `BLUEPRINT_BLUEPRINTS` captures | Open Mass ground truth |

## Pointers

- `prun-flight-planner-roadmap.html` — master roadmap + running revision log (status source of truth).
- `research/` — reverse-engineering write-ups: `landing/` (seed/PRNG), `radiation/`, plus openmass notes.
- Captures: `prun-flight-capture` (private) / `prun-flight-capture-public` — MV3 extension + pipeline.
- Credits (load-bearing to the models): Marcus Licinius Crassus (flight dynamics, ephemeris),
  Taiyi Bureau (TO/LND distance), Raylu (pruncalc), [OOG] Aem | SR (radiation + landing-damage data),
  SAGANAKI (star/system data).
