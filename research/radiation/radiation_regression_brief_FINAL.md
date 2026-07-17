# Radiation Formula Regression — Code Brief
**Session:** Prun RAD Damage Calc
**Date:** 2026-07-06

Execute all steps in sequence without stopping for confirmation. Note anything unexpected and continue. Report everything at the end. All output to `.txt` files at `C:\prun-tools\prun-dam-radiation\`.

---

## Context

Radiation damage appears in the APPROACH segment. It is isolatable using:
```
radiation_damage = (approach_no_shield - approach_specialized) / 0.70
```
Specialized Anti-rad Plate = 70% radiation damage reduction.

We have three capture files plus previously known CG-021 data. Goal: fit the formula:
```
radiation_damage = k × luminosity × AU^n
```

---

## CRITICAL: Data extraction rules

**NEVER infer or guess data fields. Always read directly from the payload.**

Planet naturalId is in:
```
segment.destination.lines[where type == 'PLANET'].entity.naturalId
```
System naturalId is in:
```
segment.destination.lines[where type == 'SYSTEM'].entity.naturalId
```

Always print full structure of the first mission's APPROACH and LANDING segments before attempting to extract any fields.

---

## Input files

All at `C:\prun-tools\prun-dam-radiation\`:

| File | Contents |
|------|----------|
| `RAD_DMG_6-7-26_RAD_NO_shield.jsonl` | No radiation shielding — VH-192, UB-557, LS-231, EY-430 |
| `RAD_DMG_6-7-26_RAD_spec__shield.jsonl` | Specialized Anti-rad Plate — VH-192, UB-557, LS-231, EY-430 |
| `RAD_DMG_6-7-26_RAD_XG_planets.jsonl` | XG-452 only — contains BOTH shield states mixed in one file |

Also needed (in `C:\prun-tools\prun-toolset\public\`):
- `planet_data.json` — for OrbitSemiMajorAxis (in metres, divide by 1.496e11 for AU)
- `systemstars.json` — for star Luminosity

---

## Step 1 — Extract all SHIP_FLIGHT_MISSION entries

For each file, parse every line, unwrap socket.io prefix (strip leading digits), extract `SHIP_FLIGHT_MISSION` payloads.

For each mission extract from segments:
- **APPROACH segment:** `app_dmg = damage`, `app_dist = stlDistance`
- **LANDING segment:** `planet = destination.lines[type=PLANET].entity.naturalId`, `lnd_dmg = damage`, `lnd_dist = stlDistance`
- **JUMP segments:** `jump_total = sum(damage)`

Print the full APPROACH and LANDING segment structure for the first mission found — confirm planet field is present before proceeding.

Deduplicate within each file by `(planet, round(app_dmg, 6))`.

---

## Step 2 — Identify shield state in XG file

The XG file contains both shielded and unshielded captures for XG-452a and XG-452c. Distinguish them by approach damage magnitude:
- XG-452a unshielded: ~1.67% approach damage
- XG-452a shielded: ~0.62% approach damage
- XG-452c unshielded: ~0.27% approach damage
- XG-452c shielded: ~0.20% approach damage

Split into two groups and label accordingly.

---

## Step 3 — Build matched pairs table

For each planet that appears in BOTH a no-shield file AND a spec-shield file, take the **median** approach damage from each set (there will be 2-3 readings per planet per shield state due to slider positions).

Known matched pairs to use:
- VH-192a, UB-557a, UB-557c, LS-231a, LS-231c, EY-430a, EY-430b, XG-452a, XG-452c

**Exclude:** VH-192d (no-shield only) and VH-192c (spec-shield only) — mismatched, do not use.

CG-021 data (already validated — hardcode these, do not re-parse):
```
CG-021a: no_shield=0.002072, spec_shield=0.001184, AU=1.0112, lum=142.9037
CG-021b: no_shield=0.001170, spec_shield=0.000913, AU=1.7282, lum=142.9037
CG-021d: no_shield=0.000878, spec_shield=0.000842, AU=5.0764, lum=142.9037
```

For each matched planet, look up AU and luminosity from `planet_data.json` and `systemstars.json` using the planet's SystemId.

---

## Step 4 — Compute radiation component

For each matched planet:
```javascript
radiation_damage = (app_no_shield - app_spec_shield) / 0.70
non_rad_component = app_no_shield - radiation_damage
```

Print full table: planet, AU, luminosity, app_no_shield, app_spec_shield, radiation_damage, non_rad_component.

Flag any planets where radiation_damage is negative or suspiciously small (< 0.0001) — these may be bad captures.

---

## Step 5 — Fit the formula

Model: `radiation_damage = k × luminosity × AU^n`

Rearrange: `log(rad/lum) = log(k) + n × log(AU)`

Regress `log(rad/lum)` against `log(AU)` using closed-form OLS:

```
x = log(AU), y = log(rad/lum), N = number of points
n = (N×Σ(x·y) - Σx·Σy) / (N×Σ(x²) - (Σx)²)
log_k = (Σy - n×Σx) / N
k = exp(log_k)
```

Do NOT use numpy or scipy — Node.js only, implement OLS manually.

---

## Step 6 — Report

Output to `C:\prun-tools\prun-dam-radiation\radiation_formula_fit.txt`:

```
RADIATION FORMULA FIT — 2026-07-06
====================================

Data points: N

Planet       AU      Lum        rad_dmg%   predicted%  residual%
-----------------------------------------------------------------
...

Fitted formula:
  radiation_damage = k × luminosity × AU^n
  k = [value]
  n = [value]

R² (log space): [value]
Max residual: [value]%
Mean absolute residual: [value]%

Non-radiation APPROACH floor (should be ~constant):
  Mean: [value]%
  Std dev: [value]%
  Min: [value]%  Max: [value]%

Comparison to previous 3-point fit (CG-021 only):
  Previous: k=8.416e-6, n=-1.963
  New:      k=[value], n=[value]
```

Also save the full matched pairs table to `C:\prun-tools\prun-dam-radiation\radiation_data_table.txt`.

---

## Notes

- `OrbitSemiMajorAxis` in `planet_data.json` is in **metres** — divide by 1.496e11 for AU
- Star luminosity is in `systemstars.json` under `Luminosity` field
- Match planet to star via `planet.SystemId == star.SystemId`
- Node.js only — no numpy/scipy
- All output to `.txt` files — console output is lost
