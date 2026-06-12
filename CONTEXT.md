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
- **FIO API** (`rest.fnar.net`) — the community PrUn data API, authenticated with an API key stored in `.env` as `VITE_FIO_API_KEY`

---

## Project Structure

### React App (the Star Map)
Entry: `index.html` → `src/main.jsx`

| File | Purpose |
|------|---------|
| `src/App.jsx` | Root — loads universe/planet/material data, manages all state |
| `src/MapView.jsx` | D3 star map — renders systems, sectors, jump lines, gateways |
| `src/Sidebar.jsx` | System detail panel — shows planets, resources, COGC info |
| `src/SearchBar.jsx` | Search systems/planets by name |
| `src/FilterPanel.jsx` | Filter map by COGC program type, resources, and planet conditions (gravity/temp/pressure/fertile) |
| `src/RoutePanel.jsx` | Route planner between two systems (Dijkstra pathfinding) |

Data files (static JSON in `/public`):
- `prun_universe_data.json` — star systems with coords and connections
- `planet_data.json` — planets with resources, COGC, fertility etc.
- `material_data.json` — material ticker/ID mapping

### Tool Pages (`/public/*.html`) — all standalone vanilla HTML+JS
| Page | Purpose |
|------|---------|
| `home.html` | Dashboard — base status overview, balance, links to all tools (12 active) |
| `prun_fleet_status.html` | Fleet ship locations and status |
| `prun_fleet_repair.html` | Fleet repair cost calculator + XIT ACT JSON export |
| `prun_base_repair.html` | Base building repair costs |
| `prun_hq_upgrade.html` | HQ upgrade planner |
| `prun_infra_upkeep.html` | Infrastructure upkeep tracker |
| `prun_recipe_finder.html` | Recipe/production chain finder |
| `prun_quick_orders.html` | Quick commodity order helper |
| `prun_price_convert.html` | Price unit converter |
| `prun_jump_planner.html` | System-to-system route finder |
| `prun_sell_finder.html` | Best exchange to sell a material — live order book, fill simulation, jump distance from origin |
| `prun_ship_builder.html` | Ship builder/comparison tool — up to 3 ships side-by-side (see below) |

All tool pages call the FIO API using `window.FIO_API_KEY` (injected at runtime from `.env` via a Vite plugin that writes `public/config.js`).

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
- Heat: damage from proximity to stars
- Radiation: damage from radiation-heavy systems
- Gravity (STS): damage from gravity anomaly systems
- General (hull plates): all damage types
- Values are damage reduction percentages (0.5 = 50%)

---

## Planet Condition Filters (Star Map)
Added to `FilterPanel.jsx` / `App.jsx`. Band thresholds matching PrUn in-game classification:
- Gravity: Low <0.25g / Med 0.25–2.5g / High >2.5g
- Temperature: Low <−25°C / Med −25–75°C / High >75°C
- Pressure: Low <0.25atm / Med 0.25–2atm / High >2atm
- Fertile: checkbox for fertile planets only

---

## Sell Finder (`prun_sell_finder.html`)
- Ticker input with datalist autocomplete from `material_data.json`
- Quantity input + origin system input
- Parallel fetch from all 5 exchanges (IC1, NC1, NC2, CI1, CI2)
- BFS pathfinding for jump distance from origin to each exchange
- Fill simulation — shows how much of the order each exchange can fill
- Exchange cards colour-coded by jump distance: green ≤3j, orange ≤6j, red >6j
- Exchange system NaturalIds: IC1→VH-331, NC1→OT-580, NC2→UV-351, CI1→ZV-759, CI2→AM-783

---

## XIT ACT JSON Format
For tools that export XIT ACT JSON (fleet repair, HQ upgrade):
- `type` must be `"CX Buy"` (with space, not underscore)
- Must include `global: { name: "..." }` field at top level
- Without `global`, PrUn imports it as RED/broken

---

## My Bases
| Planet ID | Name | Role | Status |
|-----------|------|------|--------|
| VH-331a | Promitor | Organic Farming | Active |
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
