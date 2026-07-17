# RADIATION_STATE.md
**PrUn Radiation Damage Investigation — Canonical State Document**
Last updated: 2026-07-07
Working dir: `C:\prun-tools\prun-dam-radiation\`

---

## What this document is

This is the single source of truth for the radiation damage workstream. It supersedes all previous handover docs. Every claim marked **CONFIRMED** has been validated against real game data in this session. Every claim marked **PENDING** requires further capture work.

---

## The formula (PENDING — form confirmed, constant unresolved)

```
radiationDmg = (k × Luminosity × AU⁻² × distMkm) / 100 × (1 − antiRadShield)
```

Equivalently using the FIO Sunlight field (which already bakes in AU⁻²):

```
radiationDmg = (3.56484936e-7 × Sunlight × distMkm) / 100 × (1 − antiRadShield)
```

Where:
- `AU` = planet `SemiMajorAxis` (metres) / `1.496e11`
- `distMkm` = TRANSIT segment `stlDistance` (metres) / `1e9`
- `Sunlight` = FIO `all_planets.json` field (irradiance, already incorporates AU⁻²)
- `Luminosity` = FIO star luminosity (solar units)
- `antiRadShield` = 0.70 if spec anti-rad plate equipped, 0 otherwise
- `/100` converts Aem's %/Mkm output to a damage fraction matching `segment.damage`
- `k = 4.875e-4` from Aem's generalised Radiation damage tab — **UNRESOLVED, see below**

**The unresolved constant:** Aem's workbook gives two values:
- `4.875e-4` from the generalised Sunlight tab (= `3.56484936e-7 × 1367.53`)
- An implied `~4.6e-5` from the KQ-451 BTF tab (0.0734 %/Mkm at ~1 AU)
- These disagree by 10.6×
- KQ-451 does not exist in current FIO star data — the star may have been renamed or removed
- The 0.0734 value numerically matches a B-class star (luminosity ~150), not O-class — Aem likely mislabelled the star class or used the wrong anchor luminosity
- **Working assumption: the Sunlight tab constant (4.875e-4 / 3.56484936e-7) is correct.** The KQ-451 BTF number is suspect. This must be confirmed by capture.

---

## Segment channel findings — CONFIRMED

| Channel | Result | Evidence |
|---------|--------|----------|
| APPROACH | NOT radiation | r≈0, 17 planets, Pearson correlation |
| LANDING | NOT radiation | r=−0.19, mechanical/mass-driven |
| TRANSIT | Meteor (91%) + formula slop (9%) — residual NOT shieldable | Shield test: diff=7e-7 on all 8 WX-827a segments |
| JUMP_GATEWAY | Untested for shield effect | r=0.90 on 4 planets, b=0.14 — not yet verified |
| DECAY / LOCK / TAKE_OFF | Zero damage always | Confirmed across all captures |

**Radiation lives on TRANSIT segments — as a dose (rate × distance) — not APPROACH.**
The game docs say "during FTL flight" but the data shows the dose accumulates during STL TRANSIT near a hot star, not during the FTL jump itself.

---

## Why our existing captures couldn't detect radiation — CONFIRMED

All capture planets were either:
- Too cool (K, M, G class stars — radiation negligible)
- Too far from the star (AU too large — AU⁻² makes radiation tiny)
- Meteoroid-swamped (WX-827a: density 3.13, 30 Mkm transit → meteor dominates ~50:1)

The shield difference on WX-827a TRANSIT was 7e-7 — essentially zero. This is correct: Aem's formula predicts radiation contributes ~1% of observed damage there, which is below the shield test's resolution.

**No existing captures contain a detectable radiation signal. New captures are required.**

---

## Why no low-density hot star exists — CONFIRMED

Scanned all 698 stars in `systemstars.json`. Only 9 O/B systems exist galaxy-wide (4 O + 5 B). All have `MeteoroidDensity` between 2.0 and 4.7. Hot stars and dense meteoroid fields are correlated in this map. A "low density + hot star" system does not exist.

**Strategy:** Use shield-differencing instead of density filtering. Fly each leg twice (spec anti-rad vs no-shield) at matched slider. Meteoroid is identical both runs and cancels in the difference. Only the 70%-shieldable radiation survives.

---

## Aem's model — source and provenance

- **Source:** Aem's spreadsheet, "Radiation damage" tab and "KQ-451" tab
- **Method:** Blueprint Test Flights (BTFs) around KQ-451, flying radial distance bands (2→4, 4→6.1, 6.1→11.5... AU) with and without advanced anti-rad shielding
- **Meteoroid floor:** 0.0002 %/Mkm (constant, Aem's value — use the proper meteor formula instead for the planner)
- **Shield reduction:** 70% — confirmed independently, traces back to KQ-451 tab: 0.0734/0.0224 = 3.277
- **Sunlight↔Luminosity relationship:** `Sunlight × AU² / Luminosity = 1367.53` exactly, verified across all 7 star classes and 6 orders of magnitude

**CRITICAL unit note:** Aem's formula outputs **percent** (%/Mkm). `segment.damage` is a **fraction** (0.587 = 58.7%). Always divide Aem's prediction by 100 before comparing to observed damage. The meteor formula already outputs fractions — this unit difference only applies to Aem's radiation terms.

---

## Capture design — next session

### Purpose
1. Confirm which constant (A = 4.875e-4 or B = ~4.6e-5) is correct — resolves the 10.6× discrepancy
2. Confirm the AU⁻² exponent holds across a wide range
3. Produce a calibrated k for the flight planner

### Method
Fly each leg **twice at matched slider**: once with spec anti-rad plate, once without. Subtract to isolate radiation. Meteoroid cancels.

### Capture 1 — NL-534a (magnitude + constant disambiguation)
- **System:** NL-534, O-class, luminosity 1637, MeteoroidDensity 2.00
- **Planet:** NL-534a, AU ≈ 1.98
- **Origin:** anywhere in NL-534 system (intra-system TRANSIT)
- **What to measure:** TRANSIT damage, shield vs no-shield, same slider
- **Expected gap (constant A):** ~1.4e-3 per Mkm of transit
- **Expected gap (constant B):** ~1.3e-4 per Mkm of transit
- These are 10× apart and both far above noise floor (~1e-8) — one flight discriminates them unambiguously
- **Jumps from HRT:** 12

### Capture 2 — NH-555 a↔e (AU⁻² exponent confirmation)
- **System:** NH-555, B-class, MeteoroidDensity 2.06
- **Planet a:** AU ≈ 0.90 (close in, high radiation rate)
- **Planet e:** AU ≈ 10.74 (far out, low radiation rate)
- **AU ratio:** 11.9×, radiation contrast: ~142× (AU⁻² gives 11.9² ≈ 142)
- **What to measure:** TRANSIT damage shield vs no-shield at both planets
- **Note:** Make NH-555e leg >3 Mkm to ensure gap clears floor under pessimistic constant B
- **Jumps from HRT:** 14

### Capture blueprint
- BP-KURM-2554, origin HRT (same as previous captures)
- Two files per session: `noshield.jsonl` and `spec_shield.jsonl`
- Matched slider on every pair
- Planet naturalId always from `segment.destination.lines[type=PLANET].entity.naturalId`

---

## Flight planner integration — pending k confirmation

Once k is confirmed, add to every TRANSIT segment:

```javascript
// In addition to existing meteor formula
const AU = planet.SemiMajorAxis / 1.496e11;
const distMkm = segment.stlDistance / 1e9;
const radiationDmg = (3.56484936e-7 * planet.Sunlight * distMkm) / 100
                     * (1 - ship.antiRadShield * 0.70);
totalTransitDmg = meteorDmg + radiationDmg;
```

Or equivalently using luminosity and AU:
```javascript
const radiationDmg = (4.875e-4 * star.Luminosity / (AU * AU) * distMkm) / 100
                     * (1 - ship.antiRadShield * 0.70);
```

`Sunlight` field is in `all_planets.json` and already incorporates AU⁻² — use it directly where available.

**Only matters for O and B class stars at close range.** For G, K, M, most A and F — radiation contribution is negligible for practical route planning.

---

## Files in C:\prun-tools\prun-dam-radiation\

| File | Contents |
|------|----------|
| `prun_rad_dam_noshield.jsonl` | 75 missions, 1630 segments, no shield, origin HRT |
| `prun_rad_dam_shield.jsonl` | 81 missions, 1580 segments, spec shield, origin HRT |
| `prun_rad_WX-827 GH-459 noshield.jsonl` | 8 missions, 24 segments, intra-system |
| `prun_rad_WX-827 GH-459 shield.jsonl` | 8 missions, 24 segments, intra-system |
| `radiation_flat.csv` | 3,258 rows, one per segment, all four files |
| `radiation_correlation.txt` | Pearson + log-log + power-law fits per channel |
| `workstream_c_result.txt` | Meteor verification on WX-827a TRANSIT (8.9% fit) |
| `transit_residual_shield_test.txt` | Shield test on TRANSIT residuals — diff=7e-7, not radiation |
| `aem_model_vs_captures.txt` | Aem formula vs all TRANSIT data — below detection everywhere |
| `candidate_flight_predictions.txt` | Predicted gaps for NL-534a and NH-555 a/e |
| `notes.txt` | Running provenance log |

---

## Key data files (not in working dir)

| File | Location | Notes |
|------|----------|-------|
| `all_planets.json` | `C:\prun-tools\prun-toolset\public\` | 4,576 planets, `NaturalId` field, `Sunlight` field, `SemiMajorAxis` in metres |
| `all_stars.json` | `C:\prun-tools\prun-toolset\public\` | 698 stars |
| `systemstars.json` | `C:\prun-tools\prun-toolset\public\` | `MeteoroidDensity` — system level, correctly spelled (two o's) |
| `prun_flight_planner.html` | `C:\prun-tools\prun-toolset\public\` | Meteor formula at line 837: `meteorDmgRaw()`, call sites pass `stlDistance_metres / 1e6` |

---

## Collaborators

- **Aem / SR** — radiation formula form, KQ-451 BTF dataset, landing damage datasets. The 0.70 shield factor traces back to Aem's KQ-451 tab.
- **Marcus Licinius Crassus** — flight dynamics papers, ephemeris.json
- **Taiyi Bureau** — TO/LND distance formulas, galaxy map
- **Raylu** — Refined PrUn tools, PR #164 pending

---

## What NOT to do in the next session

- Do not use the shield-delta method without mass-correcting for the 15t spec shield weight
- Do not use the `Radiation` field from `all_planets.json` as the model input — it does not correlate with observed damage
- Do not look for radiation on APPROACH or LANDING segments — confirmed dead
- Do not trust the KQ-451 0.0734 coefficient without verification — star may not exist in current game
- Do not assume TRANSIT residual after meteor subtraction is radiation — the shield test showed it isn't (it's formula slop)
