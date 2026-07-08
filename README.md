# PrUn Command

A browser-based toolsuite for [Prosperous Universe](https://prosperousuniverse.com), built by **EoinCuinn** (COSM).

Static site — no backend, no server. Drop it in a browser, paste your FIO API key, and go.

---

## Flight Planner

The primary active workstream. Physics-accurate route planner with per-leg fuel, damage, and shield recommendations across multi-leg journeys.

### What's calibrated

**Meteor damage**
Formula fitted against 19 systems, R²=0.9989:
```
damage = 7.1692e-6 × dist_km × density^p(ρ)
p(ρ) = 0.683 + 0.223 × log₁₀(ρ)
```
Density-dependent exponent — star-type multipliers were a sampling artefact, not a real signal.

**Landing distance**
Taiyi's formula confirmed correct shape, empirical correction factor ×1.131 across all test planets:
```
landingDistKm = 1.131 × radius_km × (0.15 + 0.45 × max(pressure, 0.1)^−0.301)
```

**Landing damage**
Fitted 2026-07-05, 24 points (2 blueprints × 12 planets), R²=0.989:
```
damage = 1.1322e-4 × dist_km^0.4934 × accel^−0.9441 × pressure^0.9288
```
Higher acceleration = less damage — exposure time, not speed, drives accumulation. Accel exponent −0.94 is near-perfect inverse. Known outlier: MG-197e (85 atm) over-predicted ~2×, pressure law saturates at extreme values.

**Landing fuel**
```
fuel = 354.5 × stlFlowRate × √(dist_km / accel)
```
Mean error 4.3%, max 5.9% across 12 planets × 2 blueprints.

**Approach fuel**
```
fuel = STL_tank_capacity × 0.491 × fuelUsageFactor
```
Not distance- or acceleration-dependent — confirmed empirically.

**FTL fuel and time**
```
FP_MIN_PER_PARSEC = 28.5
FP_FUEL_PER_PARSEC = 14.2
```
Empirically calibrated from flight log data.

### What's in progress

- **Radiation damage** — Aem's inverse-square form confirmed correct (damage ∝ luminosity × AU⁻²). Scaling constant pending recalibration against unshielded capture data. Placeholder formula active.
- **DEP fuel** — ~6% low, departure thrust term not yet fitted.
- **FTL/Gateway routing** — Phase 6, ready to start.

### Modes

- **Real fleet** — pulls your ships direct from FIO Swagger API (`api.fnar.net`). Prefills blueprint, mass, thrust, flow rate, condition.
- **Hypothetical** — component selector. Mix and match any hull/engine/tank/shielding combination to compare builds before committing.

### Data sources

- `planet_data.json` — planet physics (radius, pressure, gravity, `OrbitSemiMajorAxis` in metres)
- `systemstars.json` — star luminosity and meteoroid density, sourced from [Taiyi Bureau's universe map](https://github.com/Taiyi-94/prun_universe_map) (MIT)
- `ephemeris.json` — 4,199 planets. Supplied by Marcus Licinius Crassus.
- `station_data.json` — HRT and ANT orbital parameters fitted from captured SYSTEM_TRAFFIC data

---

## Other Tools

| Tool | What it does |
|------|-------------|
| Planet Finder / Jump Planner | Visual star map, resource filters, system-to-system routing |
| Planet Compare | Side-by-side planet comparison for production chain planning — COGC, resources, costs, worker requirements |
| Ship Builder | Compare up to 3 ship builds side-by-side — stats, BOM, build time |
| Fleet Status | Live fleet positions and status |
| Fleet Repair | Aggregate repair materials across fleet → XIT ACT import |
| Base Repair | Building conditions per base, shortfall vs inventory → XIT ACT import |
| Infra Upkeep | Infrastructure upkeep and upgrade costs → XIT ACT import |
| HQ Upgrade | HQ upgrade material planner |
| Recipe Finder | Full recipe tree — what a ticker needs, what you can make with it, cross-linked |
| Sell Finder | Best exchange for a ticker at current BID prices, fill simulation, jump distance from origin |
| Corp Prices | Corp contract prices vs IC1 CX ask — discount badges, watchlist |
| Price Converter | Google Sheets corp price schedule → PrUn Planner CX CSV |
| Quick Orders | Fast XIT ACT import for ad-hoc material lists |
| Flight Log | Passive flight recorder — detects completed flights, accumulates calibration data |

---

## Setup

No install. Open `home.html` in a browser (or run `npm run dev` for the React star map).

Paste your FIO REST API key in the header on first load — it saves to `localStorage` and pre-fills on return visits. No keys are hardcoded or committed anywhere.

For flight planner real-fleet mode, a FIO Swagger API key (`api.fnar.net`) is also required — different from the REST key. Create one via `POST /auth/createapikey` after authenticating with your FIO password.

For the Flight Log tool, a PUNoted data token (`api.punoted.net`) is required — generate one from your PUNoted account and paste it into the header; it saves to `localStorage` (`prun_punoted_token`). Adding your FIO REST key alongside it is optional and unlocks ship specs (Volume, Condition, Blueprint) per flight.

---

## Attribution

This project would not exist without:

- **Marcus Licinius Crassus** — definitive flight dynamics papers: duration law, speed-cap, rendezvous-floor, FTL-jump laws, ephemeris methodology. The theoretical foundation the flight planner is built on.
- **Taiyi Bureau** — takeoff/landing distance formulas, independent flight planner, universe map data (`systemstars.json`, MIT licensed). TO/LND distance formulas confirmed accurate to within empirical correction.
- **Aem | SR** — radiation damage formula, ~60-point landing damage dataset, KI-439 70-flight fuel log. Empirical backbone of the damage calibration arc.
- **xflasar** (`xSupeFly` on Discord) — [PUNoted](https://github.com/xflasar), the live flight-data API (`api.punoted.net`) that powers the Flight Log tool — ships and in-progress flights with exact timestamps.
---

## License

MIT
