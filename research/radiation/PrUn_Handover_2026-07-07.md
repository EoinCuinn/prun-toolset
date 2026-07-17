# PrUn Radiation Damage — Handover

**Date:** 2026-07-07
**Active Code session:** Prun radiation damage calculator take 2
**All radiation files:** `C:\prun-tools\prun-dam-radiation\`

---

## What happened this session — critical context

The previous handover stated **"radiation occurs on APPROACH segments only"** as confirmed fact. This session proved that was never validated. Three approaches were investigated:

1. **APPROACH segments** — shield delta is near-zero or noise on all signal planets. The ±1 STL fuel offset caused by the spec shield's 15t mass means no-shield and spec-shield pairs never share identical `stlFuelConsumption`, so exact matching fails on every O and B class planet that matters.
2. **LANDING segments** — shield frequently makes landing damage *worse*, not better. The extra 15t increases landing damage by more than any radiation reduction. Not a clean radiation channel.
3. **TRANSIT segments** — WX-827a produces **2.30 damage** on a 201 AU intra-system transit. The spec shield has zero effect on it. This is almost certainly **meteor damage** — the meteor formula needs to be run against this distance to confirm.

**Key finding:** the planet `Radiation` field exists in `all_planets.json` for all 4,576 planets, is never zero, and does **not** correlate with observed shield delta damage — because the shield delta method is contaminated by mass noise throughout. The `Radiation` field may still be the correct model input; the measurement method was the problem, not the field.

## Ship parameters (BP-KURM-2554)

- Mass no-shield: **1844t**
- Mass with spec shield: **1859t** (15t delta)
- STL acceleration: **54.2 m/s²**

## Files produced this session

- `all_stars.json` / `all_planets.json` — live FIO pull, 698 stars, 4,576 planets, committed to `prun-toolset/public/`
- `extraction_report.txt` — v1, has nearest-fuel supplementary table
- `extraction_report_v2.txt` — v2, strict identical-fuel, no dedup, correct slider captures
- `all_segments_report.txt` — every segment type, every mission, all four files
- `landing_radiation_report.txt` — LANDING segments only, matched pairs
- `radiation_correlation.txt` — planet Radiation field vs observed shield deltas
- `route_structure.txt` — every APPROACH waypoint per mission destination
- `system_classes.txt` — star class and luminosity for every system in captures
- `planet_params.txt` — gravity, pressure, radius, SemiMajorAxis for capture planets

## Capture files

- `prun_rad_dam_noshield.jsonl` — 15 planets, no shield, origin HRT
- `prun_rad_dam_shield.jsonl` — 15 planets, spec shield, origin HRT
- `prun_rad_WX-827 GH-459 noshield.jsonl` — intra-system hops, no APPROACH segments
- `prun_rad_WX-827 GH-459 shield.jsonl` — intra-system hops, no APPROACH segments

---

## Three parallel workstreams for next session

### Workstream A — Mass-corrected shield delta

Use the existing landing damage formula from the flight planner to compute the exact damage contribution of 15t extra mass for each planet. Subtract this from the observed nearest-fuel delta before dividing by 0.70. This gives a mass-corrected radiation estimate per planet. **Node.js only.** Inputs needed: landing distance (Taiyi's formula), planet pressure and radius from `all_planets.json`, STL acceleration 54.2 m/s², ship mass 1844t.

### Workstream B — Planet Radiation field as direct model input

Correlate the planet `Radiation` field from `all_planets.json` directly against total mission damage across all captures, controlling for route length. **Do not use shield deltas at all.** Use count-balanced, slider-matched pairs. Report correlation coefficient per damage channel (APPROACH, LANDING, TRANSIT). If correlation exists on any channel, fit `damage = k × Radiation^b` and report k, b, R².

### Workstream C — Meteor damage verification on WX-827

Run the existing meteor damage formula against the WX-827a TRANSIT: distance **30,172,210,561 km**, using WX-827 system meteor density from `all_planets.json`. If predicted meteor damage ≈ 2.30, the TRANSIT damage is confirmed as meteor not radiation. If predicted << 2.30, the excess is radiation on TRANSIT and changes everything.

---

## Mandatory rules — carry forward unchanged

- Read every file in its entirety — every line, every mission, every segment
- Never deduplicate on `missionId` alone — each unique `stlFuelConsumption` is a distinct slider capture
- Planet always from `segment.destination.lines[type=PLANET].entity.naturalId` — never from filename
- Shield state from filename only
- **Done means Daniel confirmed it** — not "code ran clean"
- All script output to `.txt` files — console output disappears on his machines
- **Node.js only** for all scripting

## What is confirmed and solid

- `all_planets.json` field name is `NaturalId` not `PlanetNaturalId`
- `SemiMajorAxis` in metres — divide by `1.496e11` for AU
- Spec shield mass: 15t, ship base mass: 1844t
- The planet `Radiation` field is present for all 4,576 planets, never null, never exactly zero
- WX-827 star class: **B**, luminosity 157.3
- GH-459 star class: **K**, luminosity 0.30
- IA-158 star class: **M**, luminosity 0.002 — all "signal" from IA-158b is mass noise
- `/planet/all_planets` is the correct FIO endpoint — `/map/planets` 404s

## Collaborators (credit in any public release)

- **Marcus Licinius Crassus** — flight dynamics papers, ephemeris.json
- **Taiyi Bureau** — TO/LND distance formulas, galaxy map
- **Aem / SR** — radiation formula form, damage datasets
- **Raylu** — Refined PrUn tools, PR #164 pending

---

*Handover produced: Chat, 2026-07-07. Three parallel workstreams. Previous APPROACH-only assumption discarded.*
