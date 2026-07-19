# PrUn Command

A browser-based toolsuite for [Prosperous Universe](https://prosperousuniverse.com), built by **EoinCuinn**.

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
Not a physics quantity — a deterministic PRNG draw, seeded by the `missionId` the client sends with the flight calc:
```
d = k(planet) × (13 + 4·r)
r = new java.util.Random(UUID.hashCode(missionId)).nextDouble()
```
So `d ∈ [13k, 17k)` — mean `15k`, band exactly `±2/15` (±13.3%, the familiar "±15%"). The mean is the planet radius/pressure term (Taiyi's distance work); the planner estimates it as `926 × (radius_m/1e6)^0.96 × (1 + pressure)^−0.42`.

The seed is **client-generated** and echoed verbatim by the server, so a landing is predictable from the wire — but the client mints that UUID with `crypto.getRandomValues()` (OS CSPRNG), so it is **not steerable**. Real flights inherit their plan's draw and re-roll per flight, including to an established base — the fixed-tile hypothesis is refuted. Full write-up and verification: [`research/landing/`](research/landing/).

**Landing damage**
Fitted 2026-07-05, 24 points (2 blueprints × 12 planets), R²=0.989:
```
damage = 1.1322e-4 × dist_km^0.4934 × accel^−0.9441 × pressure^0.9288
```
Higher acceleration = less damage — exposure time, not speed, drives accumulation. Accel exponent −0.94 is near-perfect inverse. Known outlier: MG-197e (85 atm) over-predicted ~2×, pressure law saturates at extreme values.

**Take-off / landing fuel** — the same STL burn physics for both legs
```
fuel     = 336.9 × stlFlowRate × √(dist_km / accel_eff)
accel_eff = min(thrust / mass, maxGFactor × 9.80665)
```
`336.9` is derived, not fitted — it is the closed form `(4/0.06) × √(350.11/13.71)` (credit: Marcus Licinius Crassus), and supersedes the earlier fitted `354.5`. Confirmed across a controlled 5-engine set. The g-force cap only binds for Hyperthrust, the one engine whose raw acceleration exceeds the hull's g-limit; capped, all five engines agree.

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

**Ship empty mass and hull volume** — derived from the blueprint dropdowns, not fitted
```
operatingEmptyMass = Σ(component weight × count)          # exact, 87/87 blueprints
totalVolume = 438 + 1.05 × cargo_capM3
              + engineΔ + stlTankΔ + reactorΔ + ftlTankΔ  # 86/87 within 0.5%
```
Empty mass is exactly the bill of material — no baseline, no hull offset. The hard part was `totalVolume`, the hull-envelope figure the game sizes plating and structure from: it is *not* the sum of component volumes (0/87) and has no constant packing factor, but it is additive over five of the twelve selectable fields and driven by the cargo bay's **m³ capacity** (not its weight or tonnage). The `1.05` is structure feedback — capacity demands space, and the plates enclosing it eat ~5% more.

With volume known the whole ship follows: plates `round(0.535 × V^0.655)`, structural components `round(0.0478 × V)`, crew quarters by volume band, command bridge by FTL-reactor tier. Hypothetical mode now computes empty mass from the dropdowns instead of a fitted aggregate — **volume 86/87 within 1% (mean 0.002% over the 86 non-vortex ships; the single miss is the vortex ship BP-CLNY-0000), mass 82/86 within 1% (mean 0.199%)**. Full write-up: [`research/openmass/`](research/openmass/).

Note for anyone reproducing this: a regression over these fields is confounded and returns confidently wrong coefficients (R²=0.992 while reporting the Quick-Charge reactor at −77 m³ where a controlled pair gives +7). Every delta was measured from one-field-change blueprint pairs.

### What's in progress

- **Radiation damage** — Confirmed real (2026-07-08). Accumulates on TRANSIT segments only; scales as k·AU⁻²·distMkm, k≈0.045 %·AU²/Mkm (O-class, two ships, pre-registered prediction confirmed). Implementation parked — path integration along the transfer ellipse is non-trivial, and star-class dependence is uncalibrated outside O-class. Anti-rad plate is non-functional (not net negative — zero measurable effect across nine captures). No radiation term in active code.
- **DEP fuel** — ~6% low, departure thrust term not yet fitted.
- **FTL/Gateway routing** — Phase 6, ready to start.

### Modes

- **Real fleet** — pulls your ships direct from FIO Swagger API (`api.fnar.net`). Prefills blueprint, mass, thrust, flow rate, condition.
- **Hypothetical** — component selector. Mix and match any hull/engine/tank/shielding combination to compare builds before committing. Empty mass and `totalVolume` are derived from the selections (see above) and shown alongside the plate/structural counts, so a build can be spot-checked against the in-game blueprint tester. A lookup of 61 captured blueprint combinations is kept as a secondary cross-check; any disagreement over 1% is flagged in the UI.

### Data sources

- `planet_data.json` — planet physics (radius, pressure, gravity, `OrbitSemiMajorAxis` in metres)
- `systemstars.json` — star luminosity and meteoroid density, sourced from [Taiyi Bureau's universe map](https://github.com/Taiyi-94/prun_universe_map) (MIT)
- `ephemeris.json` — 4,199 planets. Supplied by Marcus Licinius Crassus.
- `station_data.json` — HRT and ANT orbital parameters fitted from captured SYSTEM_TRAFFIC data

---

## Research

Reverse-engineering write-ups behind the planner's physics — game flight quantities are deterministic to ~machine precision, so these quote exact numbers sourced from packet captures. Index: [`research/`](research/).

| Folder | Subject |
|--------|---------|
| [`research/landing/`](research/landing/) | Take-off/landing distance — the `missionId`-seeded PRNG law, client-controlled seed, CSPRNG (unsteerable), fixed-tile hypothesis refuted |
| [`research/radiation/`](research/radiation/) | Radiation damage — real and ~inverse-square near hot stars, but the Specialised Anti-Radiation Plate shows no measurable effect (the open paradox). Includes captures, derived analyses, and scripts |
| [`research/openmass/`](research/openmass/) | Ship empty mass and hull volume — empty mass is exactly the BOM sum; `totalVolume` derived from the twelve selectable fields (cargo m³ capacity dominant), and the confounded-regression trap that hid it |

Each workstream ships the same doc set: a peer **SUMMARY**, a **findings_public** technical write-up, and a short **post_channel** version for Discord.

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

- **Marcus Licinius Crassus** — definitive flight dynamics papers: duration law, speed-cap, rendezvous-floor, FTL-jump laws, ephemeris methodology. Also the landing-distance PRNG law (`d = k·(13+4r)`) and the closed-form TO/LND fuel constant `336.9`. The theoretical foundation the flight planner is built on.
- **Taiyi Bureau** — takeoff/landing distance formulas, independent flight planner, universe map data (`systemstars.json`, MIT licensed). The landing-distance mean (`15k`) is their distance work; the ±13.3% band around it is the PRNG.
- **Raylu** — [pruncalc](https://git.raylu.net/raylu/pruncalc) — take-off/landing pressure and radius handling, ship repair calculator.
- **SAGANAKI** — FIO galaxy star/system data gathered and shared.
- **Aem | SR** — radiation damage formula, ~60-point landing damage dataset, KI-439 70-flight fuel log. Empirical backbone of the damage calibration arc.
- **xflasar** (`xSupeFly` on Discord) — [PUNoted](https://github.com/xflasar), the live flight-data API (`api.punoted.net`) that powers the Flight Log tool — ships and in-progress flights with exact timestamps.
---

## License

MIT
