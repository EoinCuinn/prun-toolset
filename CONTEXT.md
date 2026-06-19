# prun-map — Project Context Snapshot
> Paste this into Claude chat to bring it up to speed on the project.

---

## What This Is
A personal toolset for the browser game **Prosperous Universe (PrUn)** — a space trading/industry MMO. Built by **EoinCuinn** (in-game username).

The project lives at `C:\prun-tools\prun-map` and is served via **Vite** (`npm run dev` → `http://localhost:5173`).

---

## Tech Stack
- **Vite + React** (main map app)
- **Vanilla HTML/JS** (all the tool pages in `/public`)
- **D3.js** for the star map rendering
- **Dijkstra.js** for route-finding
- **FIO API** (`rest.fnar.net`) — the community PrUn data API. Key is user-supplied via a UI input on each page, saved to `localStorage` as `prun_apikey` and pre-filled on return visits.
- **PrUn Planner API** (`api.prunplanner.org`) — used for buildings, recipes, planet search. Key saved to `localStorage` as `prun_ppkey` (planet compare only).

No hardcoded keys anywhere. No `config.js`. Each tool has its own key input in the header; keys auto-save on input and are shared across all tools via `localStorage`.

---

## Project Structure

### React App (the Star Map)
Entry: `index.html` → `src/main.jsx`

| File | Purpose |
|------|---------|
| `src/App.jsx` | Root — loads universe/planet/material data, manages all state. Reads `?system=` URL param on load to auto-select a system. |
| `src/MapView.jsx` | D3 star map — renders systems, sectors, jump lines, gateways |
| `src/Sidebar.jsx` | System detail panel — shows planets, resources, live COGC (fetched from FIO on open) |
| `src/SearchBar.jsx` | Search systems/planets by name |
| `src/FilterPanel.jsx` | Filter map by COGC program type, resources, and planet conditions (gravity/temp/pressure/fertile) |
| `src/RoutePanel.jsx` | Route planner between two systems (Dijkstra pathfinding, gateway-aware) |

Data files (static JSON in `/public`):
- `prun_universe_data.json` — star systems with coords and connections
- `planet_data.json` — planets with resources, COGC, fertility etc.
- `material_data.json` — material ticker/ID mapping
- `systemstars.json` — star system physics: MeteoroidDensity + Luminosity per system. Sourced from [github.com/Taiyi-94/prun_universe_map](https://github.com/Taiyi-94/prun_universe_map) (MIT licence). Not available from the FIO API.
- `gateways.json` — gateway connections for BFS pathfinding

### Tool Pages (`/public/*.html`) — all standalone vanilla HTML+JS
| Page | Purpose |
|------|---------|
| `home.html` | Dashboard — base status overview, balance, links to all tools |
| `prun_planet_compare.html` | Multi-planet side-by-side comparison (see below) |
| `prun_base_repair.html` | Base building repair costs + XIT ACT export (see below) |
| `prun_fleet_status.html` | Fleet ship locations and status |
| `prun_fleet_repair.html` | Fleet repair cost calculator + XIT ACT JSON export |
| `prun_hq_upgrade.html` | HQ upgrade planner |
| `prun_infra_upkeep.html` | Infrastructure upkeep tracker |
| `prun_recipe_finder.html` | Recipe/production chain finder |
| `prun_quick_orders.html` | Quick commodity order helper |
| `prun_price_convert.html` | Price unit converter |
| `prun_jump_planner.html` | System-to-system route finder |
| `prun_sell_finder.html` | Best exchange to sell a material — live order book, fill simulation, jump distance from origin |
| `prun_ship_builder.html` | Ship builder/comparison tool + flight planner (see below) |
| `prun_corp_prices.html` | Corp price list vs IC1 CX ask — discount badges, watchlist, sortable (see below) |

---

## Planet Compare (`prun_planet_compare.html`)
Multi-planet side-by-side comparison. Pick a recipe or raw resources, find candidate planets, click up to 4 to compare in a grid.

**Two search modes** (PRODUCE / RESOURCES toggle):
- **PRODUCE**: type a ticker (e.g. RAT) → finds recipe → searches by extractable inputs
- **RESOURCES**: type comma-separated resource tickers (e.g. H2O, FEO) → searches directly. Single-resource searches auto-detect the extractor building (RIG/EXT/COL) via hardcoded `EXTRACTOR` map.

**Left sidebar:** scrollable results sorted by JUMPS / COGC / RES. Shows ⛔ FULL badge once plot data is fetched.

**Filters:** COGC pills (OR logic), FERTILE toggle, all combine with AND logic.

**Comparison table columns:**
- Access: plots (X/cap, free), jumps to HRT, faction, facilities
- COGC: active program
- Resources: bar + daily extraction rate
- Conditions: gravity/temp/pressure/fertile/surface
- Costs: production build, support build (CM + HB1-5), total build, 30d supply, est repair/mo
- Workers: pioneer/settler/etc counts
- Links: PrUn Planner (new tab) + Star Map (`/?system=VH-331`, new tab)

**APIs used:**
- PrUn Planner: `/data/buildings/`, `/data/recipes/`, `POST /data/planets/search/`, `GET /data/planet/{id}/`
  - Key field: `active_cogc_program_type` — pre-computed, no epoch filtering needed
  - Key field: `daily_extraction` on resources
- FIO: `/exchange/full` for prices, `/planet/{naturalId}` for radius, `/planet/sites/{naturalId}` (auth) for base count
- Local JSON: `prun_universe_data.json` + `gateways.json` for BFS jump distance to HRT (VH-331)

**Plot capacity formula** (derived from 3 in-game data points):
- `cap = floor(208 + radius_km / 36.1)` where `radius_km = planet.Radius / 1000` (FIO radius is in metres)
- If `site_count >= cap` → planet is FULL for regular players (starter planets exceed cap because new players bypass it)

**Cost calculations:**
- Build cost: `sum(building.costs[].material_amount × CX price) × numBuildings`
- Support cost: CM + ceil(workers/100) × HB1-5 build costs
- 30d supply: `sum over worker tiers: (count/100) × daily_consumption × 30 × CX price`
- Repair/mo: `total_build_cost × 0.03`
- Buildings input auto-updates costs without re-searching

**Worker consumption (per 100 per day):**
- Pioneer: DW×4, RAT×4, OVE×0.5, EXO×0.5, PT×0.5
- Settler: DW×5, RAT×4, OVE×0.5, COF×1, MED×1, HMS×0.5
- Technician: DW×5, RAT×2.5, MED×1, HMS×0.5, SCN×0.5, ALE×1
- Engineer: DW×5, OVE×0.5, MED×1, HMS×0.5, SCN×0.5, ALE×1, GIN×0.5, VG×1
- Scientist: DW×5, MED×2, HMS×1, SCN×1, ALE×1, GIN×1, VG×1, NST×0.5

---

## Base Repair (`prun_base_repair.html`)
Shows building conditions across all player bases, repair materials needed vs inventory, and XIT ACT export.

**Key FIO API fields:**
- `site.Buildings[].RepairMaterials[].MaterialTicker` — ticker (NOT `Ticker`)
- `site.Buildings[].RepairMaterials[].MaterialAmount` — quantity (NOT `Amount`)
- `store.AddressableId` — may be a SiteId (UUID), not PlanetNaturalId. Resolve via `siteIdToPlanet` map built from `allSites`.
- Do NOT use `type === 'BASE'` to match storage — it matches all bases. Match by resolving SiteId → PlanetNaturalId.

**Features:**
- Building condition table with All / Damaged / Critical <50% filter
- Shopping list: need vs have, shortfall highlighted red
- COPY XIT: exports shortfall as XIT ACT JSON
- IGNORE STORAGE toggle: exports ALL repair materials regardless of inventory

---

## Ship Builder (`prun_ship_builder.html`)
Built from scratch using component data sourced from https://github.com/Zillatron27/drydock.

**Features:**
- Compare up to 3 ships side-by-side in a single grid
- Dropdowns for all slots: STL Engine, STL Fuel Tank, FTL Reactor, FTL Tank, Cargo Bay, Hull Plates, Heat/Whipple/Radiation Shielding, Stability System, Repair Drones, High-G Seats
- Option labels include stat suffixes (padded to align) e.g. `Standard  —  0.015/s`
- Mod hint tags below each dropdown (colour-coded: green=good, amber=specialised, red=expensive)
- Auto-calculated rows: SSC count, bridge type (BR1/BR2/BRS), crew quarters tier, FTL emitter count
- Performance comparison table with green/red best/worst highlighting
- Bill of Materials rendered inside the same grid (guaranteed column alignment)
- Slot label column shows description sub-text for shielding/equipment slots

**Formulas (from drydock):**
- Volume: delta model from `VOLUME_REFERENCE = 963`, per-slot deltas, `NO_FTL_DELTA = -129`
- SSC: `ceil(vol / 21)`
- Hull plates: `ceil(vol^(2/3) / 2.07)`
- CQ tiers: ≤999→CQT, ≤1749→CQS, ≤2749→CQM, else CQL
- Bridge: Standard/Quick-charge→BR1, High/Hyper-power→BR2, no FTL→BRS
- FTL emitters: large/medium/small combination from volume span calculation
- Mass: sum of `bomWeight × qty` for all components
- Build time: `mass / 50` hours

**Shielding mechanics (in-game):**
- Whipple: damage from STL flight through meteoroid-dense systems
- Heat: damage from high-pressure planet atmospheres (>2 atm)
- Radiation: damage from high-luminosity stars during FTL (A/O/B type)
- Gravity (STS): damage from landing on extreme gravity planets (<0.25g or >2g)
- General (hull plates): all damage types
- Values are damage reduction percentages (0.5 = 50%)

**Flight Planner (top of page):**
- Origin/destination autocomplete: system name, system code, planet name, planet code (bidirectional labels)
- BFS pathfinding with **gateway support** — GTW hops shown in purple, regular hops numbered
- FTL time/fuel/parsecs per hop + running totals
- DEP/APP rows: real STL distance from `OrbitSemiMajorAxis` + time estimate (~7min + dist/900000 km/min)
- Hazard badges per hop: RAD (luminosity-based), MET (MeteoroidDensity from systemstars.json)
- Hazard badges on DEP/APP: HEAT (pressure >2atm), GRAV (gravity <0.25g or >2g)
- **Damage estimation column** calibrated from in-game BTF data:
  - FTL radiation: 0.000353% × parsecs
  - STL meteoroid: 2.5e-9% × dist_km × density^0.625
  - HEAT/GRAV damage not yet modelled
- **Ship selector** (FOR SHIP buttons) — applies that ship's shields to damage, shows shielded/raw
- Shield recommendation summary below table
- Empirically calibrated: FP_MIN_PER_PARSEC=28.5, FP_FUEL_PER_PARSEC=14.2, FP_SCALE=12.67
- All STL engines give identical transit time — hull G-factor is the real limiter (confirmed in-game)
- FTL reactor type makes no difference to time/fuel (confirmed in-game)
- Gateway FTL speed ~20 min/pc in-game vs our 28.5 estimate — gateways are faster per parsec

---

## Planet Condition Filters (Star Map)
Added to `FilterPanel.jsx` / `App.jsx`. Band thresholds matching PrUn in-game classification:
- Gravity: Low <0.25g / Med 0.25–2.5g / High >2.5g
- Temperature: Low <−25°C / Med −25–75°C / High >75°C
- Pressure: Low <0.25atm / Med 0.25–2atm / High >2atm
- Fertile: checkbox for fertile planets only

---

## Corp Price List (`prun_corp_prices.html`)
Shows all corp contract prices (from Google Sheet CSV) compared to live IC1 CX ask prices.

**Data sources:**
- Google Sheet CSV (same URL as `prun_price_convert.html`): col 1 = row index, col 2 = ticker, col 3 = corp price
- FIO `/exchange/full`: filter `ExchangeCode === 'IC1'` for IC1 Ask prices

**Table columns:** Ticker | Discount | Corp Price | IC1 Ask | Corp vs CX (absolute delta, green if corp < CX)

**Discount badges:** green ≥20%, amber 10–20%, red <10%, grey = no CX listing. Arrow prefix shows direction (↓ = corp cheaper).

**Watchlist (MY LIST):**
- Saved to `localStorage` as `prun_corp_watchlist` (JSON array of tickers)
- MY LIST / ALL toggle — MY LIST is default when watchlist has entries
- Chips with × to remove; text input + ADD button to add by ticker
- In ALL view: `+` button per row adds that ticker to watchlist (greys out if already in list)

---

## Sell Finder (`prun_sell_finder.html`)
- Ticker input with datalist autocomplete from `material_data.json`
- Quantity input + origin system input
- Parallel fetch from all 6 exchanges (IC1, NC1, NC2, CI1, CI2, AI1)
- BFS pathfinding for jump distance from origin to each exchange
- Fill simulation — shows how much of the order each exchange can fill
- Exchange cards colour-coded by jump distance: green ≤3j, orange ≤6j, red >6j
- Exchange system NaturalIds: IC1→VH-331, NC1→OT-580, NC2→UV-351, CI1→ZV-759, CI2→AM-783, AI1→ZV-307

---

## XIT ACT JSON Format
For tools that export XIT ACT JSON:
- `type` must be `"CX Buy"` (with space, not underscore)
- Must include `global: { name: "..." }` field at top level — without it PrUn imports as RED/broken
- `groups[].materials` is an object `{ticker: amount}`, not an array
- Shortfall items use `.Amount` as their own property name (not the FIO field `MaterialAmount`)

---

## My Bases
| Planet ID | Name | Role | Status |
|-----------|------|------|--------|
| VH-331a | Promitor | Organic Farming | Active — FULL (2164+ sites) |
| VH-331g | Avalon | RAT / DW Production | Active |
| OT-189a | Mayer | HAL Extraction | Active |
| VH-192c | Shardonia | GL Production | Active |

---

## How to Continue Working
- Dev server: `npm run dev` (or ask Claude Code to start it)
- All tool pages are self-contained HTML — edit directly in `/public`
- React map app lives in `/src` — standard Vite/React workflow
- FIO API docs: https://fio.fnar.net (community API, requires key)
- GitHub: https://github.com/EoinCuinn/prun-command
