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
| `src/FilterPanel.jsx` | Filter map by COGC program type and/or required resources |
| `src/RoutePanel.jsx` | Route planner between two systems (Dijkstra pathfinding) |

Data files (static JSON in `/public`):
- `prun_universe_data.json` — star systems with coords and connections
- `planet_data.json` — planets with resources, COGC, fertility etc.
- `material_data.json` — material ticker/ID mapping

### Tool Pages (`/public/*.html`) — all standalone vanilla HTML+JS
| Page | Purpose |
|------|---------|
| `home.html` | Dashboard — base status overview, balance, links to all tools |
| `prun_fleet_status.html` | Fleet ship locations and status |
| `prun_fleet_repair.html` | Fleet repair cost calculator |
| `prun_base_repair.html` | Base building repair costs |
| `prun_hq_upgrade.html` | HQ upgrade planner |
| `prun_infra_upkeep.html` | Infrastructure upkeep tracker |
| `prun_recipe_finder.html` | Recipe/production chain finder |
| `prun_quick_orders.html` | Quick commodity order helper |
| `prun_price_convert.html` | Price unit converter |

All tool pages call the FIO API using `window.FIO_API_KEY` (injected at runtime from `.env` via a Vite plugin that writes `public/config.js`).

---

## My Bases
| Planet ID | Name | Role | Status |
|-----------|------|------|--------|
| VH-331a | Promitor | Organic Farming | 🟢 |
| VH-331g | Avalon | RAT / DW Production | 🟢 |
| OT-189a | Mayer | HAL Extraction | 🟡 |
| VH-192c | Shardonia | GL Production | 🟡 |

---

## Recent Changes
- API key moved out of `home.html` into `.env` (`VITE_FIO_API_KEY`)
- Vite plugin auto-generates `public/config.js` on startup — tool pages read `window.FIO_API_KEY`
- `.env` and `public/config.js` are both gitignored

---

## How to Continue Working
- Dev server: `npm run dev` (or ask Claude Code to start it)
- All tool pages are self-contained HTML — edit directly in `/public`
- React map app lives in `/src` — standard Vite/React workflow
- FIO API docs: https://fio.fnar.net (community API, requires key)
