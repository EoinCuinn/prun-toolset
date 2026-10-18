# PrUn Command

A browser-based toolset for [Prosperous Universe](https://prosperousuniverse.com), built by **EoinCuinn**.

**▶ Live: [prun-toolset.onrender.com](https://prun-toolset.onrender.com)** — open the [tool launcher](https://prun-toolset.onrender.com/home.html).

No install, no accounts, no backend. Every tool runs entirely in your browser — open a link, paste your FIO API key, and go. Your key is stored only in your browser and talks straight to FIO; it never touches a server of mine. Built to be **fast and easy** — the tools load instantly and get out of your way.

> **Built with Claude.** I'm not a developer — the research and validation here are mine, the code is AI-assisted. Expect rough edges; bug reports and feedback are very welcome.

---

## The tools

Eight single-purpose tools. Click to open:

| Tool | What it does |
|------|-------------|
| **[Map & Planet Finder](https://prun-toolset.onrender.com/)** | Visual galaxy map — resource and planet-condition filters, system-to-system jump routing |
| **[Flight Planner](https://prun-toolset.onrender.com/prun_flight_planner.html)** | Exact flight time, fuel, hull damage and shield recommendations per leg — real fleet or hypothetical build. The physics is reverse-engineered to machine precision ([details below](#under-the-hood--the-flight-planner)) |
| **[CX Arbitrage](https://prun-toolset.onrender.com/prun_cx_arbitrage.html)** | Price gaps between exchanges, **order-book-depth-aware** profit (no fake "buy it all" numbers), cargo-fit haul, burn filter, one-click XIT buy |
| **[HQ Upgrade](https://prun-toolset.onrender.com/prun_hq_upgrade.html)** | Cost to move from/to any HQ level vs. your storage by location → XIT buy export |
| **[Fleet Repair](https://prun-toolset.onrender.com/prun_fleet_repair.html)** | Repair materials across selected ships vs. your base/warehouse inventory → XIT Buy + Transfer |
| **[Recipe Finder](https://prun-toolset.onrender.com/prun_recipe_finder.html)** | Drill down and across any material — its recipes, inputs and outputs, cross-linked |
| **[Quick Orders](https://prun-toolset.onrender.com/prun_quick_orders.html)** | Build an ad-hoc material list fast → XIT ACT import |
| **[Sell Finder](https://prun-toolset.onrender.com/prun_sell_finder.html)** | Best exchange to sell a ticker at current bids, fill simulation, jump distance from origin |

---

## Quick start

1. Open the [launcher](https://prun-toolset.onrender.com/home.html), or any tool link above.
2. When a tool asks for a key, paste your **FIO API key**. It saves in your browser and pre-fills next time. Nothing is sent anywhere except FIO.

**Which key?** FIO issues two different keys and they are **not interchangeable** — each tool asks for the one it needs:

- **FIO REST key** (`rest.fnar.net`) — used by most tools (Fleet Repair, HQ Upgrade, Sell Finder, …). Saved as `prun_apikey`.
- **FIO Swagger key** (`api.fnar.net`) — a separate key, used by the Flight Planner (real-fleet mode) and CX Arbitrage's burn filter. Saved separately as `prun_swaggerkey`, so entering one never overwrites the other.

**Getting the REST key** — from [fio.fnar.net](https://fio.fnar.net) (log in → API Keys).

**Getting the Swagger key** — there is no web UI for this one; you mint it by calling the API itself. `POST https://api.fnar.net/auth/login` with `{"UserName","Password"}` returns a JWT, then `POST /auth/createapikey` with that `Authorization: Bearer <jwt>` and a body of `{"UserName","Password","ApplicationName","AllowWrites": false}` returns the key. `GET /auth/listapikeys` (with `Authorization: FIOAPIKey <key>`) lists any you already have. Endpoints are browsable at [api.fnar.net/swagger/v1/swagger.json](https://api.fnar.net/swagger/v1/swagger.json). Every tool here is read-only, so `AllowWrites: false` is correct.

These are **FIO account** credentials — not your Prosperous Universe game password — and no keys are ever hardcoded or committed. (Planet Compare additionally uses a PrunPlanner API key; the Flight Log uses a PUNoted token — see those tools.)

---

## Under the hood — the Flight Planner

The deepest tool: a physics-accurate route planner with per-leg fuel, damage, and shield recommendations across multi-leg journeys. Game flight quantities are deterministic to ~machine precision, so the numbers below are exact, sourced from packet captures — not fitted guesses.

**Status: work in progress — actively calibrated.** STL well-leg fuel is exact; FTL speed, charge time and charge fuel are anchored to blueprint `ftlMaxSpeed` and emitter data; the damage model is Marcus Licinius Crassus's 2026-10-12 D model (jump, charge, take-off, landing, and DEP/APP/TRANSIT with solar flux); ship mass/volume 86/87 within 1%; landing distance is a deterministic ±13.3% band (exact if the mission seed is known). Known gaps: DEP fuel allocation (B2) and gateway damage (unknown). Hypothetical or unknown ships derive FTL speed and the emitter package from the nearest blueprint and are flagged. Heat/whipple/radiation plate effects are not modelled; the anti-rad plate measured non-functional. Treat outputs as close estimates, not gospel.

### What's calibrated

**Jump / charge / transit damage** — D model, 2026-10-12
All channels are fractions of condition × `h = 1 − SHIELDING_GENERAL`.
```
jump    = h × 1e-5 × pc
charge  = h × 5e-4 × (ρ − E/P)
DEP/APP/TRANSIT = h × d_km × [2e-12 + 5e-12·ρ + 2e-22·√(F1·F2)]
F = Luminosity × 3.0605e25 / r_km² at the 3-D endpoints
```
The old meteor v5 fit was an approximation of `2e-12 + 5e-12·ρ`. The star re-enters through
flux, which is where the worst residual lived. NL-534 validation: predicted/observed 0.91–0.93
on the radial legs; the same-distance inward-dive control matches within 1.7%.

**Landing distance**
Not a physics quantity — a deterministic PRNG draw, seeded by the `missionId` the client sends with the flight calc:
```
d = k(planet) × (13 + 4·r)
r = new java.util.Random(UUID.hashCode(missionId)).nextDouble()
```
So `d ∈ [13k, 17k)` — mean `15k`, band exactly `±2/15` (±13.3%). The mean is the planet
radius/pressure term (Taiyi's distance work), now used directly as `pf × R(km)` with
`pf = 0.15 + 0.45·max(P,0.1)^(−log10 2)` (A4). The planner shows this mean; the per-flight
draw is ±13.3%.

The seed is **client-generated** and echoed verbatim by the server, so a landing is predictable from the wire — but the client mints that UUID with `crypto.getRandomValues()` (OS CSPRNG), so it is **not steerable**. Real flights inherit their plan's draw and re-roll per flight, including to an established base — the fixed-tile hypothesis is refuted. Full write-up and verification: [`research/landing/`](research/landing/).

**Take-off / landing damage** — D model, 2026-10-12
```
take-off = h × T × G(g)
landing  = h × T × [G(g) + min(4e-7·P, 1e-5)]
G(g) = 1.5e-5 + 6e-5·(0.25 − g)   for g < 0.25
     = 1.5e-5 + 6e-6·(g − 2.5)    for g > 2.5
     = 0                           otherwise
```
`T` is the well-leg duration. The old M2 fit had the wrong accel exponent (−0.94 instead of
−0.5) and the pressure term hard-caps at P = 25, so MG-197e is not an outlier.

**Take-off / landing fuel** — exact well-leg allocation (B3)
```
M = ceil(√(d_km / (13.71 × accel_atm)))       accel_atm = accel / 350.11
t = d_km / (2 × accel_atm × M) + 2M
fuel = M × stlFlowRate / 0.015
```
This is the same burn physics as the derived closed form `336.9 × flow × √(dist/accel)`
(`336.9 = (4/0.06)·√(350.11/13.71)`, credit Marcus Licinius Crassus); the integer `M` and
trapezoidal time are the exact game form. The g-force cap clamps `accel` to
`maxGFactor × 9.80665`.

**Approach fuel**
```
fuel = STL_tank_capacity × 0.491 × fuelUsageFactor
```
This is preview-derived; B2 will replace it and the DEP split with the real-flight fuel
allocation model.

**FTL speed, charge time and fuel** — blueprint-anchored (C, 2026-10-18)
```
J(1) = 3600 / ftlMaxSpeed (pc/h)
J(ρ) = J(1) · e^(β(1−ρ))
β: RCT 1.123 · QCR 0.929 · HPR 2.002 · HYR 2.976
charge time = (3/8)·P·ρ/f per charge (jumps − 1)
  at the E/P floor this is (3/8)·E/f
charge fuel = ⌊P·ρ·pc/333⌋ FF per jump (first charge on departure)
E = 100·SFE + 175·MFE + 300·LFE; slider floor = E/P
```
88 blueprint entries (85 with FTL) come from the captured `BLUEPRINT_BLUEPRINTS` performance
data (`public/blueprint_ftl.json`); unknown or hypothetical ships use the C3 hull-volume fit
and are flagged in the UI.

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

- **Radiation / solar flux** — implemented in D as `Luminosity·3.0605e25/r(km)²` at the 3-D
  endpoints. The anti-rad plate remains non-functional (zero measurable effect across nine
  captures); `research/radiation/` is retained as validation.
- **DEP fuel allocation** — still preview-calibrated. B2 will replace the DEP/APP split with the
  real-flight allocation model.
- **FTL** — C implemented: blueprint `ftlMaxSpeed` anchors, measured β, emitter-based charge
  time, charge fuel and slider floor. Gateway damage remains unknown.

### Modes

- **Real fleet** — pulls your ships direct from FIO Swagger API (`api.fnar.net`). Prefills blueprint, mass, thrust, flow rate, condition.
- **Hypothetical** — component selector. Mix and match any hull/engine/tank/shielding combination to compare builds before committing. Empty mass and `totalVolume` are derived from the selections (see above) and shown alongside the plate/structural counts, so a build can be spot-checked against the in-game blueprint tester. A lookup of 61 captured blueprint combinations is kept as a secondary cross-check; any disagreement over 1% is flagged in the UI.

### Data sources

- `planet_data.json` — planet physics (radius, pressure, gravity, `OrbitSemiMajorAxis` in metres)
- `systemstars.json` — star luminosity and meteoroid density, sourced from [Taiyi Bureau's universe map](https://github.com/Taiyi-94/prun_universe_map) (MIT)
- `ephemeris.json` — 4,199 planets. Supplied by Marcus Licinius Crassus.
- `station_data.json` — HRT and ANT orbital parameters fitted from captured SYSTEM_TRAFFIC data
- `prun_universe_data.json` — star systems with 3D coords and jump connections
- `gateways.json` — gateway links, used alongside the above for BFS jump-distance routing
- `material_data.json` — material ticker/ID mapping and item properties

All live in `public/`. Read material properties from `material_data.json` rather than hardcoding them.

---

## Research

Reverse-engineering write-ups behind the planner's physics — game flight quantities are deterministic to ~machine precision, so these quote exact numbers sourced from packet captures. Index: [`research/`](research/).

| Folder | Subject |
|--------|---------|
| [`research/landing/`](research/landing/) | Take-off/landing distance — the `missionId`-seeded PRNG law, client-controlled seed, CSPRNG (unsteerable), fixed-tile hypothesis refuted |
| [`research/radiation/`](research/radiation/) | Radiation damage — real and ~inverse-square near hot stars, but the Specialised Anti-Radiation Plate shows no measurable effect (the open paradox). Includes captures, derived analyses, and scripts |
| [`research/openmass/`](research/openmass/) | Ship empty mass and hull volume — empty mass is exactly the BOM sum; `totalVolume` derived from the twelve selectable fields (cargo m³ capacity dominant), and the confounded-regression trap that hid it |
| [`research/MARCUS_REVIEW_2026-10-12.md`](research/MARCUS_REVIEW_2026-10-12.md) | Full flight-planner correction pass — constants, timing, FTL, damage, routing |

Each workstream ships the same doc set: a peer **SUMMARY**, a **findings_public** technical write-up, and a short **post_channel** version for Discord.

---

## For developers

### Repo layout

- `public/` — the standalone tool pages. Every one is self-contained vanilla HTML + JS with no build step; edit them directly.
- `src/` — the React star map (Vite). `App.jsx` holds the data loading and state, `MapView.jsx` the D3 rendering, plus `Sidebar` / `SearchBar` / `FilterPanel` / `RoutePanel`. Route-finding is Dijkstra over `prun_universe_data.json` + `gateways.json`.
- `research/` — reverse-engineering write-ups (see above).

`npm run dev` serves the React app on `http://localhost:5173`; the tool pages are reachable under `/` from the same server. The live site is a Render **static site** (`npm run build` → `dist/`), auto-deployed from `main` — see `render.yaml`.

### Also in the repo (not on the launcher)

Kept for refinement, reachable by direct URL but not linked from the launcher:

| Tool | Status |
|------|--------|
| `prun_planet_compare.html` | Side-by-side planet comparison (COGC, resources, costs); needs a review pass. Uses a PrunPlanner API key (`prun_ppkey`). |
| `prun_ship_builder.html` | Compare up to 3 ship builds; WIP — will tie into the Flight Planner |
| `prun_infra_upkeep.html` | Infrastructure upkeep/upgrade costs → XIT; under review |
| `prun_price_convert.html` | Corp price schedule → PrunPlanner CX CSV; niche |
| `prun_corp_prices.html` | Corp contract prices vs IC1 CX ask; needs UI changes |
| `prun_fleet_status.html` | Live fleet positions; largely covered by Refined PrUn now |
| `prun_base_repair.html` | Building conditions vs inventory → XIT; largely covered by Refined PrUn |
| `prun_flight_log.html` | Passive flight recorder — accumulates calibration data. Uses a PUNoted token. |

### Implementation notes

Non-obvious things that cost real time to work out, kept here so they aren't rediscovered.

**XIT ACT JSON export** (Base Repair, Fleet Repair, Infra Upkeep, Quick Orders, HQ Upgrade, CX Arbitrage)
- `type` must be `"CX Buy"` — with a space, not an underscore.
- A top-level `global: { name: "..." }` field is mandatory. Without it PrUn imports the action as broken/red.
- `groups[].materials` is an object `{ticker: amount}`, not an array.
- A buy-only package won't import — the game needs the matching `MTRA` transfer action alongside the `CX Buy` (`origin` = the source station's warehouse, `dest` = `"Configure on Execution"`). This mirrors PRUNplanner's working `useXITAction` export; confirmed in-game.

**Two FIO keys** — REST (`rest.fnar.net`, raw `Authorization: <key>`, stored `prun_apikey`) and Swagger (`api.fnar.net`, `Authorization: FIOAPIKey <key>`, stored `prun_swaggerkey`) are **different keys and not interchangeable**. Keeping them in separate `localStorage` slots is deliberate — they used to share one slot and overwrite each other.

**FIO repair-material field names** — the nested fields are `RepairMaterials[].MaterialTicker` and `.MaterialAmount`, not `Ticker` / `Amount`. Storage matching is the other trap: `store.AddressableId` can be a SiteId UUID rather than a planet natural ID, so resolve SiteId → PlanetNaturalId from the sites list. Matching on `type === 'BASE'` matches every base at once and is wrong. And ship-cargo stores (`SHIP_STORE`) are stale-prone and not usable for repair — exclude them from "have" inventory.

**Plot capacity** — `cap = floor(208 + radius_km / 36.1)`, where `radius_km = planet.Radius / 1000` (FIO reports radius in metres). A planet with `site_count >= cap` is full for regular players; starter planets exceed the cap because new players bypass it.

**Exchange system natural IDs** — IC1→VH-331, NC1→OT-580, NC2→UV-351, CI1→ZV-759, CI2→AM-783, AI1→ZV-307.

**Star map planet-condition bands**, matching the in-game classification — gravity low <0.25g / high >2.5g; temperature low <−25°C / high >75°C; pressure low <0.25atm / high >2atm.

---

## Attribution

This project would not exist without:

- **Marcus Licinius Crassus** — definitive flight dynamics papers: duration law, speed-cap, rendezvous-floor, FTL-jump laws, ephemeris methodology. Also the landing-distance PRNG law (`d = k·(13+4r)`) and the closed-form TO/LND fuel constant `336.9`. The theoretical foundation the flight planner is built on.
- **Taiyi Bureau** — takeoff/landing distance formulas, independent flight planner, universe map data (`systemstars.json`, MIT licensed). The landing-distance mean (`15k`) is their distance work; the ±13.3% band around it is the PRNG.
- **Raylu** — [pruncalc](https://git.raylu.net/raylu/pruncalc) — take-off/landing pressure and radius handling, ship repair calculator.
- **SAGANAKI** — FIO galaxy star/system data gathered and shared.
- **Zillatron27** — [drydock](https://github.com/Zillatron27/drydock) — the ship component data the Ship Builder was originally built from.
- **Aem | SR** — radiation damage formula, ~60-point landing damage dataset, KI-439 70-flight fuel log. Empirical backbone of the damage calibration arc.
- **xflasar** (`xSupeFly` on Discord) — [PUNoted](https://github.com/xflasar), the live flight-data API (`api.punoted.net`) that powers the Flight Log tool — ships and in-progress flights with exact timestamps.
- **Jan Placht** — [PRUNplanner](https://github.com/PRUNplanner/frontend) (MIT) — the HQ upgrade cost table was cross-checked against it, and the XIT ACT export format used across the buy/transfer tools follows its working implementation.

---

## License

MIT
