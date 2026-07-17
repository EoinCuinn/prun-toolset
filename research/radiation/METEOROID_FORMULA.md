# Meteoroid damage formula

The radiation analysis in this repo separates total TRANSIT damage into a
**meteoroid** component and a **radiation** component. The meteoroid component is
predicted by the formula below, taken verbatim from the flight-planner's
`meteorDmgRaw` function. (The full flight-planner tool is not included in this
research bundle — only the one formula the analysis depends on.)

## The function (verbatim)

```js
function meteorDmgRaw(transitDistKm, density) {
  const rhoExp = 0.683 + 0.223 * Math.log10(Math.max(density, 0.001));
  return 7.1692e-6 * transitDistKm * Math.pow(Math.max(0.001, density), rhoExp);
}
```

## Written out

```
damage = 7.1692e-6 × distMkm × density^(0.683 + 0.223·log10(density))
```

## Inputs, units, and conventions

- **`transitDistKm` / `distMkm`** — the transit distance in **millions of km**.
  In the captured payloads `segment.stlDistance` is in **kilometres**, so
  `distMkm = stlDistance / 1e6`. (This is the same convention under which the
  formula reproduces observed transit damage; some intermediate scripts used
  `/1e9` instead — a 1000× bookkeeping difference to watch for.)
- **`density`** — the system's `MeteoroidDensity` (from the FIO galaxy data, e.g.
  `systemstars.json`). A floor of `0.001` is applied.
- **Result** — `damage` as a **fraction of ship condition** (matching the
  `segment.damage` field), before any shielding.

## Coefficients

- Base coefficient `k = 7.1692e-6`
- Density exponent `0.683 + 0.223 · log10(density)`
- Density floor `0.001`

## Shielding

In the tool, the raw output is passed through the general shield pool
(`applyShield(meteorDmgRaw(...), sh.general)`) — Whipple/general shielding reduces
the meteoroid channel multiplicatively. The **radiation** channel is separate and,
per this study, is not measurably reduced by the Specialised Anti-Radiation Plate.

## Provenance

Extracted from `prun_flight_planner.html`, function `meteorDmgRaw`. The meteoroid
coefficient was itself fitted to real captured flights; see the write-ups for the
~8.9% systematic under-prediction observed on WX-827a and the note about possible
radiation contamination of the meteoroid fit near hot stars.
