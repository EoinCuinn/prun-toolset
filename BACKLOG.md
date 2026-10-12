# prun-toolset — backlog

Consolidated open work as of **2026-10-12**, after the public launch and Marcus
Licinius Crassus's physics review. Source docs: `MARCUS_REVIEW_2026-10-12.md`,
`HANDOVER_2026-10-12.md` (laptop drive). Detailed phase history lives in
`public/prun-flight-planner-roadmap.html`; this is the flat to-do list.

Priority tags: 🔴 high · 🟡 medium · 🟢 low. Roadmap links in [brackets].

---

## Flight Planner — Marcus corrections (physics)

Marcus's verdict: structure is right; errors are in constants and a few fitted
proxies that have closed forms. His suggested order is reflected below.

- 🔴 **A1 — jump damage is 35× too high.** `0.000353·pc` → `h·1e-5·pc`. One constant, biggest single error. [reopens Phase 5]
- 🔴 **B1 — G-cap not applied on real fleet (~8% on every clamped ship).** Clamp accel to `9.81·(plate G + seat bonus)`. **Check FIO's `Acceleration` field first — it may already include the clamp (near-free).** [reopens Phase 1/3 "G-cap confirmed"]
- 🟡 **A2 — TO/LND fuel constant** `337.3` → `336.9 = (4/0.06)·√(350.11/13.71)`. [refines "TO/LND fuel solved"]
- 🟡 **A3 — take-off distance** `R(km)·(0.15 + 0.45·P^log10(2))`, no floor (exact on 86,564 legs). Current 0.1482/0.4521/0.30 are rounded.
- 🟡 **A4 — landing mean** `pf·R(km)`, `pf = 0.15 + 0.45·max(P,0.1)^(−log10 2)` — replaces the 6%-median `926·R^0.96·(1+P)^−0.42` fit; use for landing **time** too.
- 🟡 **A5 — landing roll** `d = (pf·R/15)·(13 + 4r)`, r from missionId PRNG (±13%).
- 🔴 **B4 — ephemeris fallback runs backwards.** Motion is `M = −n·worldtime + π/2` (clockwise); fallback propagates prograde with M0=0 → wrong rendezvous for every unfitted planet. [Part 3]
- 🟡 **B5 — in-system reduction** should project O & P to z=0 before `calculateSltDistance3D` (0.155% → 0.033%); prefer the tabulated reduction surface over the formula.
- 🟡 **D — full damage model** (apply as a block; terms interact through `h = 1−SHIELDING_GENERAL`): jump, charge, take-off, landing, DEP/APP/TRANSIT (meteor `2e-12 + 5e-12·ρ` + flux `2e-22·√(F1·F2)`). Landing M2 fit has the wrong accel exponent (−0.5 not −0.94); MG-197e is not an outlier (pressure caps at P=25). [closes reopened Phase 5]
- 🟡 **B2 / B3 — STL leg timing ignores the fuel slider** (DEP/APP 14–32% short on the H1 anchor). Allocate fuel first, then time. ⚠ **Recalibrate on REAL flights, not CALCULATE_TEST_FLIGHT previews.** Biggest restructure. [reopens Phase 3]
- 🟢 **C1–C6 — FTL, now fully specified** (charge fuel `⌊P·ρ·pc/333⌋`, reactor β constants, A linear in hull volume, blueprint anchor, slider floor, charge time). Phase 6, mostly new work. [Phase 6]
- 🟢 **F — ship builder fractional component volumes** (QCR 6–7, HPR 116–117, MFL 5–6, MSL 125.8–126.2). With A6/A7/A8, empty-mass chain is perfect 160/160. **Desktop-only** — needs `C:\prun-tools\prun-openmass\`. [Ship Val / reopens Open Mass]

### Ship builder (part of F)
- 🟢 **A6 — SSC** `⌈V/21⌉`.
- 🟡 **A7 — hull plates** `⌈(36π)^(1/3)·V^(2/3)/10⌉` (exact; current `⌈V^(2/3)/2.07⌉` misses 6/160). [reopens Open Mass]
- 🟢 **A8 — CQT band** ends ~900, not 999 (CQS fitted at V 962–981).

### Routing — DECISION LOCKED
- ❌ **Do NOT add distance weighting to the map router.** Marcus (§E) confirmed the game routes by **fewest jumps**, so the uniform-weight Dijkstra is *correct*; distances would diverge from the game. This **overrides** the handover's "add distances (Raylu)" note. Only open part: equal-hop tie-break (greedy farthest-from-dest matches server 84%; rest is server-side non-determinism). Tell Raylu min-hop is intentional.

---

## Flight Planner — other gaps (from the roadmap)

- 🟡 DEP-segment fuel ~6% low — likely subsumed by B2/B3.
- 🟡 Radiation damage — the DEP/APP/TRANSIT flux term in **D** is the model; implement with D.
- 🟢 Planet ephemeris — 13/459 covered. [Part 3 "Planets"]
- 🟢 Station orbit fitting — HRT + ANT done; MOR / BEN / HUB / ARC remaining. [Part 3 "Stations"]

---

## Other tools

- 🟡 **Corp Prices** — UI changes (flagged, not done); still off the launcher.
- 🟢 **Ship Builder** — tie into the Flight Planner (held off the launcher).
- 🟢 **Username localStorage harmonize** — `prun_fiouser` (home/Flight Planner/CX Arbitrage) vs `prun_username` (most REST tools); pick one.
- 🟢 Review the 4 other held-off tools (Planet Compare, Infra Upkeep, Price Converter) for whether they ever go on the launcher.

---

## Infra / repo / docs / community

- 🟡 **Host Marcus's review in `research/`** with his name (paper-grade, repo is public + MIT; currently only a Discord message + laptop drive).
- 🟡 **Capture extension — verify what's actually loaded on the desktop.** Laptop copies hook incoming messages only; the roadmap claims outgoing test-flight capture (BLUEPRINT_BLUEPRINTS / SHIP_SHIPS). Confirm before trusting. [Capture Ext]
- 🟢 **SAGANAKI attribution** — may be FIO's developer ("Saganaki, FNAR Industries"). If so the current credit undersells them. Ask the community.
- 🟢 Stale laptop repos cleanup (`prun-flight-capture`, `prun-map`, `prun-command` — last two point at the old `prun-command.git` remote).
- 🟢 Docs — technical write-ups / community papers. [Part 4 "Docs", Pending]
- 🟢 `prun-dam_acc` research repo consolidation. [Repo C, In Progress]

---

## Roadmap reconciliation (what Marcus changes)

Marcus's review **reopens several items the roadmap marks "Complete":**

| Roadmap item | Status in roadmap | Marcus's finding |
|---|---|---|
| Phase 1 — "G-cap formula confirmed" | Complete | Formula known, but **not applied** in real-fleet mode (B1, ~8%). |
| Phase 3 — Acceleration Integration | Complete | **Leg timing ignores the fuel slider** (B2/B3, 14–32% short). |
| Open Mass — empty mass & volume | Complete | **Plate formula misses 6/160** (A7); component volumes are fractional (F) → fix gives 160/160. |
| Phase 5 — Damage Model | Reopened | Now has the **full correction spec** (A1 + D) to close it. |
| Phase 6 — FTL & Gateway Routing | Ready | Now **fully specified** by Marcus (C1–C6). |

Already-aligned / no change: Phase 2, CS1, the release/review/attribution items (all genuinely done), ephemeris & station coverage (still in progress as the roadmap says).

**Conflict resolved:** routing — handover said add distance weighting, Marcus says don't. Min-hop stays (see Routing above).

**Suggested next:** A1 (one constant, 35×) → B1 (check FIO `Acceleration` field, maybe near-free) → A2–A5 → B4 → D → B2/B3 → C → F (desktop).
