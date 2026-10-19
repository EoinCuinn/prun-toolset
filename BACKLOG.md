# prun-toolset — backlog

Consolidated open work as of **2026-10-18**, after the public launch, Marcus
Licinius Crassus's physics review, and the DeepSeek validation pass. Source docs:
`MARCUS_REVIEW_2026-10-12.md`, `HANDOVER_2026-10-12.md` (laptop drive). Detailed
phase history lives in `public/prun-flight-planner-roadmap.html`; this is the
flat to-do list. The 2026-10-18 pass validated the forward HRT→OZ-189a BFT route
to +2s ETA and +0.6 STL units; the remaining work is generalisation to other
ships/routes and the smaller items below.

Priority tags: 🔴 high · 🟡 medium · 🟢 low. Roadmap links in [brackets].

---

## Flight Planner — Marcus corrections (physics)

Marcus's verdict: structure is right; errors are in constants and a few fitted
proxies that have closed forms. His suggested order is reflected below.

- ✅ **A1 — jump damage** — done 2026-10-18. `h·1e-5·pc` (was `0.000353·pc`, 35× too high). [Phase 5]
- ✅ **B1 — G-cap** — done. FIO `Acceleration` is exactly `Thrust/Mass` (no clamp); real-fleet accel is clamped from the blueprint `maxGFactor`, with `public/blueprint_maxg.json` (88 entries). [Phase 1/3]
- ✅ **A2 — TO/LND fuel constant** — done. `336.9 = (4/0.06)·√(350.11/13.71)`.
- ✅ **A3 — take-off distance** — done. `R(km)·(0.15 + 0.45·P^log10(2))`.
- ✅ **A4 — landing mean** — done. `pf·R(km)`, `pf = 0.15 + 0.45·max(P,0.1)^(−log10 2)`; used for time too.
- 🟢 **A5 — landing roll** — optional. `d = (pf·R/15)·(13 + 4r)`, r from the missionId PRNG (±13.3%); the planner shows the mean.
- ✅ **B4 — ephemeris fallback direction** — done. Clockwise motion `M = −n·worldtime + π/2`.
- ✅ **B5 — in-system z=0 projection** — **done**. DEP, APPROACH and same-system TRANSIT all project both endpoints to z=0 before `calculateSltDistance3D` and use `chargedKm`. Test11 APP +0.02%; Big Hauler APP +0.03% (was +68.6% in 3-D). The 3-D endpoints are retained only for solar-flux damage.
- ✅ **D — full damage model** — done. Jump, charge, take-off, landing, DEP/APP/TRANSIT with solar flux; `h = 1−SHIELDING_GENERAL`; pressure cap P=25. Test11 planner 0.179% vs game 0.169%.
- 🟡 **B2 / B3 — STL fuel allocation** — **split implemented 2026-10-18.** Wells first; `depCap = M_dep × flow/0.015`; `appBase = (loaded − TO) × 0.491 × fuf`; then **DEP = min(depCap, appBase)** and **APP = appBase**, with DEP timed at its allocated M. Test11: DEP 304/304, APP 429.6/430, ETA 6h20m57s vs game 6h20m55s. Big Hauler cargo: APP 588.1/583, total STL 1159.6/1156. BP-OMCU high fuf: DEP +12.95% → **+2.28%**, total STL +6.51% → **+1.73%**. **Still open:** ~2% residual at high fuf and a small game-side floor at very low fuf.
- ✅ **C1–C6 — FTL** — done. Charge fuel `⌊P·ρ·pc/333⌋`, measured β, blueprint anchor, slider floor, charge time `(3/8)·P·ρ/f`. **Capture finding (2026-10-18):** lane-jump time is `J(1)·pc`; the reactor-usage slider scales charge time and FTL fuel, not lane-jump speed. Test11, Big Hauler and BP-OMCU all match with jump speed held at blueprint `J(1)`. BP-FYSQ-7703's panel 3.50 pc/h is rounded; its `j1 = 1023.54 s/pc` anchor is exact. [Phase 6]
- 🟢 **F — ship builder fractional component volumes** (QCR 6–7, HPR 116–117, MFL 5–6, MSL 125.8–126.2). With A6/A7/A8, empty-mass chain is perfect 160/160. **Desktop-only** — needs `C:\prun-tools\prun-openmass\`. [Ship Val / reopens Open Mass]

### Ship builder (part of F)
- ✅ **A6 — SSC** — done 2026-10-19. `⌈V/21⌉` matches **55/55** unique BP-export configurations (old `round(0.0478V)` matched 44/55).
- ✅ **A7 — hull plates** — done 2026-10-19. `⌈(36π)^(1/3)·V^(2/3)/10⌉` matches **55/55** (old `round(0.535·V^0.655)` matched 36/55). Worst OEM error fell 1.15% → 0.06%.
- 🟢 **A8 — CQT band** ends ~900, not 999 (CQS fitted at V 962–981).
- 🟡 **Emitter-set mass** — the hypothetical builder has no emitter-count input, so it uses a fixed 0.8 t placeholder (sweep median; real sets 0.5–2.6 t). Exact BOM emitter mass makes OEM exact (0.00% worst). Next: add emitter counts to the hypothetical builder or import them from a blueprint/BP export.

### 2026-10-18 validation pass (DeepSeek)

- ✅ **Gate geometry** — planet gates are **0.5 AU** from the planet; station gates are
  **0.15 AU** from the station. Captured across 10 multi-system missions (5 planet
  departures at 74,798,935 km; 4 station departures at 22,440,000 km). Direction from
  the system-map positions was already correct. DEP and APP both use the body-type rule.
- ✅ **Departure distance** — the game builds the transfer ellipse in the **z=0 plane**
  and bills its **charged (rank-one reduced)** distance, not the 3-D arc and not the
  straight-line chord. Across 39 captured departures this matches to 0.03–0.55% on most
  cases (worst: MOR 3.7%, a reduction-surface approximation).
- ✅ **Test11 forward validation** (HRT→OZ-189a, BP-FYSQ-7703): game 6h20m55s, 779 STL,
  435 FTL; planner 6h20m57s, 779.6 STL, 435 FTL. DEP 304 vs 304; APP 429.6 vs 430;
  LND 46 vs 45; damage 0.179% vs 0.169%.
- ✅ **Big Hauler validation** (ANT→EY-351c, BP-JRAJ-3531, gateways off): game 239,484s,
  1006 STL, 700 FTL; planner 239,468s, 1001.2 STL, 700 FTL. DEP +0.01%, APP +0.03%,
  FTL jump time +0.00%, damage 0.3% both. This also confirmed the stored BP-JRAJ
  `vmax = 1.80695 pc/h`; no `j1` anchor was needed.
- ✅ **BP-OMCU-0214 "Stability Upgrade"** (VH-192c→EY-303b, direct, fuf .81): TO/DEP/APP
  distances/times within 0.7%, FTL fuel/charge exact, jump time -0.68%, damage 0.4%
  both. After the B2/B3 split: DEP fuel +2.28%, APP +0.83%, total STL +1.73% (was
  +12.95% / +6.51%). The BOM includes **STS:1** (stability system, gravity shield);
  BP-OMCU performance anchors added to the planner data.
- 🟡 **Generalisation** — the next tests are the same model on other ships and routes.
  Watch: per-blueprint `j1` (panel vmax may be rounded; BP-JRAJ-3531's stored vmax was
  exact), FIO `stlFuelLoad` vs loadout slider (`STL_UNIT_MASS=0.06`), and gateway-route
  legs (use a direct route for now).
- ✅ **Capture replay validator** — built at `prun-flight-capture/validator` (jsdom).
  It joins captured test-flight requests/responses, injects the captured ship, route,
  loadout and settings into the real planner page, freezes the clock to the captured
  departure timestamp, runs `calculate()`, and prints a leg-by-leg comparison. The
  latest Test11 capture passes (ETA +0.01%, STL +0.08%, FTL exact); the Big Hauler
  and BP-OMCU direct configs pass except the ~2% high-fuf B2/B3 residual. Gateway routes
  are skipped. Local/private tool; `--ship`/blueprint data handles custom hashes.

### 2026-10-19 BP export sweep (DeepSeek)

- ✅ **Importer/report built.** `prun-flight-capture/validator/bp_export_report.js` parses
  `C:\prun-tools\prun-dam_acc\BP_Exports` (25 files, 69 `BLUEPRINT_BLUEPRINT` records,
  3 natural IDs → **55 unique configurations**), feeds each configuration's selections
  into the real planner hypothetical builder in jsdom, and compares game
  OEM/volume/plates/SSC/max-G/acceleration/FTL. Output: `bp_export_report.md`
  (private capture repo).
- ✅ **Structure validated.** Volume is within **0.10%** on every configuration; OEM is
  within **0.06%** (mean −0.00%); max-G exact; acceleration tracks OEM. The residual is
  only the fixed 0.8 t emitter-mass placeholder — using each export's exact BOM emitter
  mass makes OEM exact (0.00% worst).
- ✅ **A6/A7 confirmed exact.** `ceil(V/21)` and `ceil((36π)^(1/3)·V^(2/3)/10)` match
  **55/55**; the old formulas matched 44/55 and 36/55. Applied to the planner.
- ✅ **FTL charge exact 55/55** (nearest same-reactor blueprint).
- 🟡 **FTL speed needs the emitter package.** The no-emitter volume-fit estimate ranges
  **−51.4% … +4.9%**. With the exact emitter package plus the C3 within-class linear
  fit, the error is **0.01% worst** over the 23 configurations with ≥2 class anchors;
  single-anchor classes copy the nearest blueprint and reach **1.55%**. The missing
  input is the auto-emitter count/package.
- **Next:** make the importer create a synthetic blueprint anchor per exported
  configuration (exact P/E/f/vmax/volume + exact OEM), then run a common route through
  the planner for each variant to produce the fuel/time/damage “are the parts worth it”
  comparison. Adding emitter counts to the hypothetical builder is the other route to
  exact FTL speed for new designs.

### 2026-10-19 in-game capture — BP-YEKV-6526, EY-303f→ANT

- **Settings were outside the validated envelope:** `fuf = 0.05`, `ruf = 0.651`,
  1500 STL / 300 FTL, gateways off. Route 15 jumps / 107.4 pc.
- ✅ **Validator fixed:** it now injects the captured `BLUEPRINT_BLUEPRINTS` performance
  as `_blueprintFtl` / `_blueprintMaxG` anchors for replay. BP-YEKV-6526 is newer than
  the static planner data; without the anchors the replay lost its G-cap and FTL speed.
  After the fix: TO distance 44,466.7 vs 44,467.0, **TO time 1065 vs 1062 (−0.28%)**,
  **TO fuel 120 vs 121 (+0.83%)**.
- 🔴 **Low-`ruf` FTL gap (new).** The route distance and jump count match (15 jumps,
  14 charges, 107.4 pc vs ~106.4 pc / 0.9%), but at `ruf .651`:
  - game jump time 195,166s vs planner 97,316s (**×2.0**);
  - game charge 2,441.6s vs planner 4,102s (**×0.60**);
  - game FTL fuel 292 vs planner 492 (**×0.59**).
  The current model holds lane-jump speed at `J(1)` and scales charge/fuel by `ρ`.
  That holds at high `ruf` (BP-OMCU .964 matched), but not at .651. Needs a controlled
  `ruf` sweep (e.g. .25/.50/.75/1.0) on one route to derive the low-usage law.
- ✅ **Low-`fuf` gap — root cause found and fixed 2026-10-19.** The planner clamped
  `fuf` at **0.1** even though the slider and game allow **0.05**. Removing the clamp
  changed the Big Hauler direct-route `fuf .05` result from **DEP fuel +89.7% / total
  STL +75.5% / ETA −0.64%** to **DEP fuel −1.26% / total STL −1.9% / ETA +0.07%**.
  Remaining at `.05`: APP fuel −4.6%, APP time +3.8% (small low-fuf residual).
- ✅ **Big Hauler fuel sweep** (direct route, gateways off, ruf 100%): after the APP
  coefficient update **0.491 → 0.494**, `fuf .25/.50/.75/1.00` → STL
  **−0.42/−0.23/−0.15/−0.10%**, ETA **+0.01%**, FTL exact, damage 0.3% both.
  `fuf .05` → APP fuel **−3.9%**, APP time **+3.3%**, total STL **−1.46%**, ETA **+0.06%**.
  The 0.494 coefficient is fitted from this sweep; it improves the direct-route average
  (APP MAE 15.3 → 12.4 units across the non-gateway captures) but leaves a route-dependent
  ~0.5–1.5% APP residual. Test11 total STL +0.42% (was +0.08%); BP-OMCU +2.29% (was +1.73%).
- ✅ **Big Hauler reactor sweep** (`.975/.98/.987/.994/1.0`): FTL fuel and charge exact
  at every point; jump time worst **−0.38%** at `.975`; ETA worst **−0.37%**. High-ruf
  FTL is solid. Big Hauler cannot go lower — its `E/P` floor is **97.5%** — so low-rho
  data still needs a low-minimum ship (BP-YEKV ~30%, BP-FYSQ ~20%).
- 🟡 **APP distance** game 27.46M vs planner 20.18M on the BP-YEKV flight. The destination
  is station ANT; the mismatch is consistent with the planner arriving ~98,000s earlier
  because of the low-`ruf` FTL error, so the station is at a different orbital position.
  Re-check after the FTL fix before treating it as a station-ephemeris error.

**Next-test checklist:** for each ship/route, record the blueprint, **loadout slider units**,
`fuelUsageFactor`, and route. Compare TO/DEP/APP/LND/FTL fuel and time leg-by-leg. If the FTL
jump time is ~0.5% off, derive a `j1` from the captured jump (`j1 = jump_seconds / pc`) and add
it to `blueprint_ftl.json`. If APP fuel is off by ~2×, check it is using the loadout slider,
not FIO storage or tank capacity. If a planet/station departure is off, check the gate body
type (0.5 AU vs 0.15 AU) and the z=0 charged distance.

### Routing — DECISION LOCKED
- ❌ **Do NOT add distance weighting to the map router.** Marcus (§E) confirmed the game routes by **fewest jumps**, so the uniform-weight Dijkstra is *correct*; distances would diverge from the game. This **overrides** the handover's "add distances (Raylu)" note. Only open part: equal-hop tie-break (greedy farthest-from-dest matches server 84%; rest is server-side non-determinism). Tell Raylu min-hop is intentional.

---

## Flight Planner — other gaps (from the roadmap)

- ✅ DEP fuel — fixed and validated on Test11 (304 vs 304); the old ~6% preview error is retired.
- ✅ Radiation damage — implemented in D as the DEP/APP/TRANSIT solar-flux term.
- 🟡 **Damage residual** — Test11 planner 0.179% vs game 0.169% (0.010 pp). Re-check D against other ships/routes before chasing a single constant.
- 🟡 **Damage channels / mitigation** — ✅ **breakdown implemented 2026-10-19.** The
  results now show jump, charge, gravity (TO/LND), meteor, solar flux, landing pressure
  and gateway contributions, with a total row; the total is unchanged and the channel sum
  is checked. Only **general** shielding is applied. Channel-specific mitigation is still
  open:
  - **Radiation:** the 2026-07 radiation study showed radiation is real on **TRANSIT**
    (inverse-square near hot stars), but the Specialised Anti-Radiation Plate measured
    **zero effect** across every controlled pair. Do not wire the 70%.
  - ✅ **Whipple/meteor — validated and implemented 2026-10-19.** Same-hull
    none / BWH / AWH A/B (BP-JRAJ-3531, BP-CRVM-2067, BP-PHCF-6272; EY-351 density
    2.62): BWH removes **50%** and AWH removes **100% of the density-dependent meteor
    term**; the flat `2e-12` meteor base is unshieldable. Planner totals after the
    factor: none **0.289%** vs game 0.2884; BWH **0.245%** vs 0.2448; AWH **0.203%**
    vs 0.2026. The departure/approach/transit split all follows the same rule.
  - **Heat / gravity:** untested. Heat should be tested on a high-pressure landing;
    gravity/STS on a high-g TO/LND.
  - **Capture data:** only a single `damage` field per segment; there is no per-channel
    game readout. Attribution must come from controlled A/B differences, as the
    radiation study did.
  - **A/B tests to run:** whipple: same blueprint/hull, WX-827a TRANSIT, matched slider
    and loadout, no whipple vs BWH/AWH (radiation is negligible there). Heat: same ship,
    high-pressure planet landing, BPT/APT vs none. Gravity: same ship, high-g planet
    TO/LND, STS vs none. Only apply a factor after a same-hull delta is measured; label
    any provisional factor in the UI.
- 🟡 **FTL `j1` audit** — BP-FYSQ-7703 is calibrated; other blueprints use their stored
  `vmax`. If jump times drift on the next ships, add a `j1` anchor from captured jumps.
- 🟡 **Gateway flight legs** — a captured ANT→EY-351c test used a gateway
  (`JUMP_GATEWAY` ZV-307→IA-158) with pre-gateway `TRANSIT`/`LOCK`/`DECAY` and a
  post-gateway departure from IA-158b. The planner now has a **Use gateways** toggle
  (mirrors the game's `useGateways`); with it off the direct Big Hauler route matches
  exactly. The gateway **legs** themselves (transit/lock/decay/post-gateway departure)
  are still not modelled; the capture validator skips gateway routes. Use a direct
  route for configuration/fuel validation, or implement gateway legs separately.
- 🟡 **Configuration lab** — ✅ **prototype built 2026-10-19.** `bp_config_lab.js`
  registers a synthetic blueprint anchor per exported configuration (exact OEM, volume,
  thrust, max-G, P/E/f/vmax, engine flow, shielding) and flies one common route
  (VH-192c→EY-303b, gateways off, fuf .81, ruf 1, 1500 STL / 800 FTL clamped, 0 cargo).
  All **55/55** configurations fly; the report has per-configuration ETA/STL/FTL/damage,
  headline extremes, and per-sweep deltas. Initial findings: the FSE engine is the
  fuel-saver (~−390 STL vs AEN, small time cost); bigger cargo bays trade volume for
  FTL time (+4 to +31 h); high-power reactors cut ETA from ~23 h to 3.6 h but need a
  much larger FTL tank (426→1543 fuel); AHP/HHP hull plates cut damage by ~0.12–0.25 pp
  vs LHP; heat/whipple/radiation plates show no damage effect under the current D model.
  **Cargo passes 2026-10-19:** `LAB_CARGO=100` (the largest load every hull can carry)
  changes ETA/STL on **31/53** configurations; `LAB_CARGO=500` changes **39/53** and flags
  7 rows whose cargo capacity is below 500 t. High-thrust ships that remain above their
  max-G cap show **no cargo effect at all**; the effect appears only when cargo pushes
  acceleration below the cap (e.g. the glass-engine build: 10.15 h / 1185.5 STL empty →
  10.22 h / 1224.9 at 100 t). Reports: `bp_config_lab.md`,
  `bp_config_lab_cargo100.md`, `bp_config_lab_cargo500.md`.
  ✅ **BP import path built 2026-10-19.** Hypothetical mode has an **Import blueprint…**
  file picker for `BLUEPRINT_BLUEPRINT` exports (single/array/JSONL). It applies the exact
  OEM, volume, plate/SSC, thrust/max-G, cargo, shielding and FTL P/E/f/vmax anchor;
  changing a component returns to the estimated builder. Validated against the lab: the
  imported BHP1 build reproduces 19.79 h / 1146.1 STL / 512 FTL, and a glass-engine BP
  gets its exact 9.087 pc/h instead of the ~4.41 pc/h no-emitter estimate.
  Next: validate the lab's damage deltas against in-game flights.
- 🟢 Planet ephemeris — 13/459 covered. [Part 3 "Planets"]
- 🟢 Station orbit fitting — HRT + ANT done; MOR / BEN / HUB / ARC remaining. [Part 3 "Stations"]

---

## Other tools

- 🟡 **Corp Prices** — UI changes (flagged, not done); still off the launcher.
- 🟢 **Ship Builder** — tie into the Flight Planner (held off the launcher).
- 🟢 **Username localStorage harmonize** — `prun_fiouser` (home/Flight Planner/CX Arbitrage) vs `prun_username` (most REST tools); pick one.
- 🟢 Review the 4 other held-off tools (Planet Compare, Infra Upkeep, Price Converter) for whether they ever go on the launcher.

---

## Launcher / home page

- 🟡 **Info / "About" modal** (ⓘ button on home). Higher leverage than a changelog — orients first-time visitors. Consolidate: what this is, unofficial / not Simulogics, the two-key REST-vs-Swagger explainer, credits, GitHub link. Currently scattered in the footer.
- 🟢 **"What's new" → GitHub commits/releases.** Link it straight at the repo's commit history (not a hand-maintained on-site list) — always current, zero maintenance, gives the "it's alive" signal for free.
- 🟢 Optional honesty stamp: a quiet "Updated <date>" in the footer; later wire to the latest build/file date so it never goes stale.
- ⏸️ **Hand-maintained on-site changelog — deliberately deferred.** Revisit once ship cadence slows and the audience grows; tie entries to git tags so it's semi-automatic. A stale changelog reads as abandoned — worse than none.

---

## Infra / repo / docs / community

- ✅ **Marcus's review hosted in `research/`** as [`MARCUS_REVIEW_2026-10-12.md`](research/MARCUS_REVIEW_2026-10-12.md) — permission confirmed 2026-10-18. Paper-grade reference for the correction work.
- 🟡 **Capture extension — verify what's actually loaded on the desktop.** Laptop copies hook incoming messages only; the roadmap claims outgoing test-flight capture (BLUEPRINT_BLUEPRINTS / SHIP_SHIPS). Confirm before trusting. [Capture Ext]
- 🟢 **SAGANAKI attribution** — may be FIO's developer ("Saganaki, FNAR Industries"). If so the current credit undersells them. Ask the community.
- 🟢 Stale laptop repos cleanup (`prun-flight-capture`, `prun-map`, `prun-command` — last two point at the old `prun-command.git` remote).
- 🟢 Docs — technical write-ups / community papers. [Part 4 "Docs", Pending]
- 🟢 `prun-dam_acc` research repo consolidation. [Repo C, In Progress]

---

## Roadmap reconciliation (what Marcus changes)

Marcus's review reopened several items. Current status after the 2026-10-18 pass:

| Roadmap item | Status now | Remaining |
|---|---|---|
| Phase 1 — G-cap | ✅ done | Blueprint `maxGFactor` + `blueprint_maxg.json`; FIO Acceleration is unclamped thrust/mass. |
| Phase 3 — Acceleration Integration | 🟡 mostly | DEP/APP fuel-first split implemented; ~2% high-fuf residual and low-fuf floor remain. |
| Open Mass — empty mass & volume | 🟢 mostly | A6/A7 exact and applied (55/55 BP-export configs); A8/F and emitter-count input remain. |
| Phase 5 — Damage Model | 🟡 partial | Total D model + channel breakdown; whipple/meteor mitigation validated and implemented 2026-10-19; heat/radiation/gravity mitigation still open. |
| Phase 6 — FTL & Gateway Routing | ✅ mostly | C1–C6 implemented; `j1` anchor for BP-FYSQ-7703; gateway damage unknown. |

Already-aligned / no change: Phase 2, CS1, the release/review/attribution items (all genuinely done), ephemeris & station coverage (still in progress as the roadmap says).

**Conflict resolved:** routing — handover said add distance weighting, Marcus says don't. Min-hop stays (see Routing above).

**Suggested next:** turn the BP-export report into the configuration lab (synthetic blueprint anchors + a common route for fuel/time/damage per variant), then gateway route legs, B2/B3 high-fuf/low-fuf residual, damage residual, FTL `j1` audit, then ship-builder F. Validate each against in-game test flights.
