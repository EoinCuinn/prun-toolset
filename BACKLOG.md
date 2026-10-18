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
- 🟡 **B5 — in-system z=0 projection** — **partly done**: DEP now projects both endpoints to z=0 before `calculateSltDistance3D` and uses `chargedKm`; this fixed the near-radial station-gate cases (Test4/6). **Still open for APPROACH and same-system TRANSIT**, which use 3-D positions (Test11 APP +0.43%).
- ✅ **D — full damage model** — done. Jump, charge, take-off, landing, DEP/APP/TRANSIT with solar flux; `h = 1−SHIELDING_GENERAL`; pressure cap P=25. Test11 planner 0.179% vs game 0.169%.
- 🟡 **B2 / B3 — STL fuel allocation** — **partly done, validated on the BFT route.** DEP fuel = `M_dep × stlFlowRate/0.015` (Test11: 304 vs game 304). APPROACH fuel = `loaded_STL_units (loadout slider) × 0.491 × fuf` (Test8/11: 429.6 vs 430), and APPROACH is timed at `M_app = appFuel/(flow/0.015)` (Test11: 21m42s vs game 21m38s). Test11 total 6h20m57s vs game 6h20m55s; 779.6 vs 779 STL; 435 FTL exact. **Still open:** the full Marcus `wells → rem → dep/app` split with a general `committed` budget for arbitrary fuel-load/usage combinations. The current formulas reproduce the validated BFT flights.
- ✅ **C1–C6 — FTL** — done. Charge fuel `⌊P·ρ·pc/333⌋`, measured β (RCT 1.123, QCR 0.929, HPR 2.002, HYR 2.976), blueprint anchor, slider floor, charge time `(3/8)·P·ρ/f`. **New:** capture-calibrated `J(1)` anchor for `BP-FYSQ-7703` (`j1 = 1023.54 s/pc`, effective 3.517 pc/h; the panel's 3.50 is rounded) makes the Test11 jump time exact. [Phase 6]
- 🟢 **F — ship builder fractional component volumes** (QCR 6–7, HPR 116–117, MFL 5–6, MSL 125.8–126.2). With A6/A7/A8, empty-mass chain is perfect 160/160. **Desktop-only** — needs `C:\prun-tools\prun-openmass\`. [Ship Val / reopens Open Mass]

### Ship builder (part of F)
- 🟢 **A6 — SSC** `⌈V/21⌉`.
- 🟡 **A7 — hull plates** `⌈(36π)^(1/3)·V^(2/3)/10⌉` (exact; current `⌈V^(2/3)/2.07⌉` misses 6/160). [reopens Open Mass]
- 🟢 **A8 — CQT band** ends ~900, not 999 (CQS fitted at V 962–981).

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
- 🟡 **Generalisation** — the next tests are the same model on other ships and routes.
  Watch: per-blueprint `j1` (panel vmax may be rounded), FIO `stlFuelLoad` vs loadout
  slider (`STL_UNIT_MASS=0.06`), and the B5 approach/transit z=0 projection.

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
- 🟡 **FTL `j1` audit** — BP-FYSQ-7703 is calibrated; other blueprints use their stored
  `vmax`. If jump times drift on the next ships, add a `j1` anchor from captured jumps.
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
| Phase 3 — Acceleration Integration | 🟡 partly | DEP/APP fuel-first + timing validated on Test11; full `committed` split still open. |
| Open Mass — empty mass & volume | 🟡 partly | Plate/volume formulas (A6/A7/A8, F) still pending; desktop data needed. |
| Phase 5 — Damage Model | ✅ done | D implemented and Test11-validated; 0.010 pp residual to re-check. |
| Phase 6 — FTL & Gateway Routing | ✅ mostly | C1–C6 implemented; `j1` anchor for BP-FYSQ-7703; gateway damage unknown. |

Already-aligned / no change: Phase 2, CS1, the release/review/attribution items (all genuinely done), ephemeris & station coverage (still in progress as the roadmap says).

**Conflict resolved:** routing — handover said add distance weighting, Marcus says don't. Min-hop stays (see Routing above).

**Suggested next:** validate the same model on other ships/routes (the user is doing this now), then full B2/B3 `committed` split, B5 approach/transit z=0, damage residual, FTL `j1` audit, then ship-builder F.
