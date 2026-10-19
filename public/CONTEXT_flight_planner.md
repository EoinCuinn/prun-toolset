# Flight Planner — Technical Context (updated 2026-10-19)

Technical reference for `public/prun_flight_planner.html`. For the phase-by-phase
history, gates, and running revision log, see `prun-flight-planner-roadmap.html` —
that is the status source of truth; this file is the "how it works" companion.

## Current state (2026-10-19)

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
  fuel = (loaded loadout units − TO fuel) × 0.491 × fuf; APPROACH is timed at its
  fuel-derived M.**
  Test11: 779.6 vs game 779 STL, ETA 6h20m57s vs 6h20m55s. The B2/B3 split is implemented
  (`DEP = min(dep cap, after-TO approach base)`, `APP = approach base`); a ~2% high-fuf
  residual remains, plus a small APP residual at fuf .05. The APP coefficient was refit
  0.491 → 0.494 from the 2026-10-19 Big Hauler sweep.
- **FTL (C, 2026-10-18):** blueprint-anchored `J(1)`; measured β; emitter-based charge
  time; charge fuel; slider floor `E/P`. A capture-calibrated `j1` anchor overrides a
  rounded panel `ftlMaxSpeed` (BP-FYSQ-7703: 1023.54 s/pc, effective 3.517 pc/h). See §6.
- **BP export sweep (2026-10-19):** 25 export files / 69 `BLUEPRINT_BLUEPRINT`
  records / **55 unique configurations** replayed through the planner's hypothetical
  builder. Volume within 0.10%, OEM within 0.06%, max-G exact, FTL charge exact. With
  the exact emitter package + C3 within-class fit, FTL speed is within **0.01%** for
  classes with ≥2 anchors; the no-emitter estimate is unreliable (**−51%…+5%**), so a
  saved/imported blueprint anchor is required for exact speed.
- **Blueprint import (2026-10-19):** hypothetical mode has an **Import blueprint…**
  file picker for a game `BLUEPRINT_BLUEPRINT` export (single object, array, JSONL,
  optional `42` WebSocket prefix). It maps the selections to the component dropdowns,
  then uses the export's exact OEM, volume, plate/SSC counts, thrust/max-G, cargo
  capacity, shielding and FTL P/E/f/vmax anchor. Changing a component returns to the
  estimated hypothetical build and clears the import status.
- **Empty mass & totalVolume (Open Mass; A6/A7 2026-10-19):** derived from the loadout,
  not a fitted aggregate. Volume 86/86 within 1%. **A6/A7 are now exact:** plates
  `ceil((36π)^(1/3)·V^(2/3)/10)` and SSC `ceil(V/21)` match **55/55** unique BP-export
  configurations; empty mass is within **0.06%** (mean −0.00%), and exact (0.00% worst)
  when the BOM emitter-set mass replaces the 0.8 t placeholder.
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
- **Approach / transit** use the same **z=0** projection (B5 complete): DEP at `departureLegCalc`,
  APPROACH at `stlRendezvousFromGate`, same-system TRANSIT at `stlRendezvous`. Test11 APP
  +0.02%; Big Hauler APP +0.03%. The 3-D endpoints are kept only for solar-flux damage.
- **Gateways:** a **Use gateways** toggle controls routing (the game's `useGateways` preference).
  Gateway *legs* — pre-gateway TRANSIT/LOCK/DECAY and post-gateway departure — are still not
  modelled; use a direct route for configuration validation.

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
- **APPROACH fuel (B2/B3, 2026-10-18):** `(loaded_STL_units − TO fuel) × 0.491 × fuf`.
  Use the **flight loadout slider**, not FIO storage and not tank capacity. Subtract the
  take-off burn first (wells first); station origins have TO=0 and are unchanged. Test8:
  storage 2,130 u, slider 1,750 u; no TO; game burns 430 = 1,750 × 0.491 × 0.5. The old
  tank-capacity form gave exactly 2×. Big Hauler config (2,989 t cargo, TO 39): APP
  588.1 vs game 583; total STL 1159.6 vs 1156. APPROACH is timed at
  `M_app = appFuel / (stlFlowRate/0.015)` using `t = d/(2·a·M) + 2M` when `d > 4aM²`;
  Test11 21m42s vs game 21m38s.
- **Fuel usage slider:** TO / LND / JUMP are invariant to `fuelUsageFactor`; DEP and APPROACH
  use the laws above. Old per-leg fuel slider removed; `fuelUsageFactor` input added
  (default 0.50, range 0.10–1.00).
- **B2/B3 allocation (2026-10-18; APP coefficient 2026-10-19):** wells are taken first;
  `depCap = M_dep × flow/0.015`; `appBase = (loaded − TO) × 0.494 × fuf`; then
  `DEP = min(depCap, appBase)` and `APP = appBase`. The DEP time is re-derived from the
  allocated DEP fuel. The 0.494 coefficient is fitted from the Big Hauler fuf sweep
  (old 0.491 was ~0.6% low). BP-OMCU: DEP +2.28%, total STL +2.29%. **2026-10-19:** the
  old `fuf` clamp at 0.1 was removed (slider/game allow 0.05); Big Hauler `fuf .05` went
  from DEP fuel +89.7% / total STL +75.5% to **−1.26% / −1.46%**, ETA −0.64% → **+0.06%**;
  APP fuel/time at .05 remain **−3.9% / +3.3%**. At `fuf .25–1.0` total STL is within
  **0.42%** and ETA +0.01%.
- **Same-system TRANSIT fuel:** `(tank − TO − LND) × fuf`, unchanged (validated 2026-07-11).

### 6. FTL jump + gateway — calibrated (C, 2026-10-18)

`J(1) = 3600 / ftlMaxSpeed` (pc/h). At **high ρ (≈0.96–1.0)**, captured Test11,
Big Hauler and BP-OMCU show **lane-jump time = J(1)·pc**; ρ scales **charge time and
FTL fuel**, not lane-jump speed. Measured β values (RCT 1.123, QCR 0.929, HPR 2.002,
HYR 2.976) are retained as reactor data. **At low ρ this breaks down:** a 2026-10-19
capture at ρ=.651 (BP-YEKV-6526, 107.4 pc, 15 jumps) gave game jump time **2.0×** the
planner, while charge time and FTL fuel were **0.60×/0.59×** the planner. The route
distance and jump count matched, so this is a low-usage FTL law gap, not routing or
ship data. Needs a controlled ρ sweep (.25/.50/.75/1.0) before fitting. Charge time `(3/8)·P·ρ/f` per charge (the E/P
floor gives `(3/8)·E/f`), counts jumps−1; charge fuel `⌊P·ρ·pc/333⌋` FF per jump, first
charge on departure. `E = 100·SFE + 175·MFE + 300·LFE`; slider floor `E/P`. 89 blueprint
entries in `public/blueprint_ftl.json`; unknown/hypothetical ships are flagged.
`FP_SCALE = 12.0`. Gateway: `t_gw = d_ftl × 1200 + 1220` s (3 pc/hr, ship-independent);
gateway damage unknown.

**FTL-speed estimate (2026-10-19):** the C3 law — `1/ftlMaxSpeed` linear in volume
*within a (reactor, emitter) class* — is exact to **0.01% worst** on the 55-config BP
sweep when the exact emitter package is known. The current no-emitter fallback fits
across emitter classes and is off by **−51%…+5%**; it must not be trusted for a new
build. Imported blueprint anchors carry the exact P/E/f/vmax and avoid this entirely.

**Capture-calibrated `J(1)` anchor (2026-10-18):** the in-game panel rounds `ftlMaxSpeed`
to two decimals, so `BP-FYSQ-7703`'s displayed 3.50 pc/h is really ~3.517. Its
`blueprint_ftl.json` entry now carries `"j1": 1023.54` s/pc, preferred over
`3600/vmax`; this made the Test11 jump time exactly 5h44m22s. Other blueprints use
their stored `vmax` until a capture shows drift.

### 7. Empty mass & totalVolume — "Open Mass" (2026-07-18; A6/A7 2026-10-19)

Hypothetical empty mass is derived from the twelve selectable components, not a fitted number:
- **`operatingEmptyMass = Σ(component BOM weight × count)`** over the full bill of material,
  including auto-added parts. Exact on 87/87 captured blueprints.
- **`totalVolume = 438 + 1.05 × cargo_capM3 + engineΔ + stlTankΔ + reactorΔ + ftlTankΔ`.** Cargo
  drives it by m³ capacity, not tonnage. It is a fixed point (the game sizes structure *from*
  volume, and that structure then occupies volume) — NOT the sum of component volumes.
- Downstream (A6/A7, exact on 55/55 BP-export configurations):
  `plates = ceil((36π)^(1/3) · V^(2/3) / 10)`, `SSC = ceil(V / 21)`, crew quarters by
  volume band, command bridge by FTL-reactor tier, FTL field controller if an FTL reactor is fitted.
- Emitter set: the game adds 0.5–2.6 t of FTL field emitters (SFE 0.1 / MFE 0.2 / LFE 0.4 t each).
  The hypothetical builder has no emitter-count input, so it uses the 0.8 t sweep median;
  using the exact BOM emitter mass makes the empty-mass chain exact.
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
- **UI / channels (2026-10-19):** the results now include a channel attribution table —
  jump, charge, gravity (TO/LND), meteor, solar flux, landing pressure and gateway. The
  values are **model attribution after general h**, not a game channel readout, and they
  sum to the unchanged total. The heat/whipple/radiation/gravity dropdowns still affect
  mass and the shield record, but D applies only general shielding; channel-specific
  mitigation is open (BACKLOG “Damage channels”).
- **Radiation research (2026-07):** radiation is real on **TRANSIT** and inverse-square near
  hot stars, but the Specialised Anti-Radiation Plate measured **zero effect** in every
  controlled pair. Do not wire the 70%. A +100% Whipple ship had a ~9% lower meteor floor
  than a different no-whipple ship; this needs a same-hull A/B before applying a whipple
  factor. Capture data contains only a single `damage` field per segment — no channel sort.
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
  `(loaded loadout units − TO fuel) × 0.491 × fuf`; APPROACH M = `appFuel / (flow/0.015)`.
  Test11: 6h20m57s vs game 6h20m55s; 779.6 vs 779 STL. Big Hauler config (2,989 t cargo):
  ETA +0.64%, STL 1159.6 vs 1156.
- **The game bills z=0 charged distance, not the 3-D arc or chord:** departure endpoints
  are projected to z=0 and `calculateSltDistance3D().chargedKm` is used. Station gates are
  0.15 AU; planet gates 0.5 AU.
- **Read-only, no keys committed** — FIO key/username in localStorage (`prun_apikey` /
  `prun_fiouser`); nothing else persists.

---

## Open items / known issues

1. **B2/B3 residual** — the split is implemented and fixes the high-fuf case, but BP-OMCU
   is ~2.3% high on total STL. The 2026-10-19 Big Hauler sweep shows `fuf .25–1.0` within
   **0.42%** on STL and +0.01% ETA; `fuf .05` is within 1.46% STL / 0.06% ETA after the
   0.1 clamp was removed, with a remaining APP fuel/time residual (−3.9% / +3.3%).
   The APP coefficient 0.491 → 0.494 is fitted from that sweep; the residual is
   route-dependent (~0.5–1.5%), so one global constant cannot make every route exact.
2. **Gateway route legs** — the Use gateways toggle controls routing, but the pre-gateway
   TRANSIT/LOCK/DECAY and post-gateway departure are not modelled. Use a direct route for
   configuration validation.
3. **Damage residual** — Test11 0.179% vs 0.169%; re-check D on other ships/routes before
   fitting anything.
4. **FTL `j1` audit** — BP-FYSQ-7703 is calibrated (1023.54 s/pc); other blueprints use their
   stored `vmax`. Add a `j1` anchor if captured jump times drift.
5. **Gateway damage** — still unknown; retains the `GATEWAY_DMG = 5.247e-5` estimate.
6. **Emitter package / FTL speed for new builds** — A6/A7 closed the plate/SSC rounding.
   The remaining empty-mass input is the auto-emitter set (0.5–2.6 t). The hypothetical
   builder has no emitter-count input, so its FTL speed without a blueprint anchor can be
   off by **−51%…+5%**. **Resolved for saved blueprints:** hypothetical mode now has an
   **Import blueprint…** path that applies the export's exact structure and FTL anchor.
   A brand-new hand-built design still needs an export or emitter selectors.
7. **Vortex drive** — unmodelled (1 sample, BP-CLNY-0000); outside the twelve selectable fields.
8. **Ship Builder ↔ Flight Planner** — to share one component/physics model (planned).
9. **Dead code** — `engineFromThrust()` / `engineType` (landing rewrite) and
   `approachComputedMax()` (B2/B3) are now unused; safe to delete.
10. **Low-ρ FTL law** — a 2026-10-19 BP-YEKV capture at ρ=.651 shows game jump time 2.0×
    the planner and charge/FTL fuel 0.60×/0.59×. The Big Hauler sweep at ρ=.975–1.0 is
    much milder: FTL fuel/charge exact, jump time worst −0.38%, ETA worst −0.37%. The
    effect grows sharply below ~.9; Big Hauler cannot go lower (E/P floor .975). Needs a
    low-minimum ship (BP-YEKV ~.30, BP-FYSQ ~.20) sweep before fitting.

---

## Data sources

| Data | Source | Notes |
|---|---|---|
| Planet orbits | `ephemeris.json` (Marcus) | 4199 planets, ~0.03% arc; fallback `planet_data.json` (FIO, ~1.5%) |
| Star mass / density | `systemstars.json` (SAGANAKI via FIO) | meteoroid density + luminosity; API field is `MeteroidDensity` (one 'o') |
| Gateways | `gateways.json` | FTL lane data |
| Material weights | `material_data.json` | fuel-store capacity |
| Ship data | FIO Swagger `api.fnar.net/ships` | thrust, mass, OEM, volume, reactor/emitter, flow, condition, `BlueprintNaturalId`; **no blueprint BOM endpoint** |
| Fuel stores | FIO `api.fnar.net/storage` | live STL/FTL fuel loads; **the flight uses the loadout slider, not this total** |
| Blueprint setups | Captured `BLUEPRINT_BLUEPRINTS` (`blueprint_data.jsonl`) | wire hash → naturalId, BOM, performance; refreshed 2026-10-18 with BP-JRAJ-3531 and BP-FYSQ-7703 |
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
