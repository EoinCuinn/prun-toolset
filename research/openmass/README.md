# Open mass research

Deriving a ship's **empty mass** and **hull volume** from the twelve components a player selects in the blueprint designer — so the flight planner's Hypothetical mode reproduces the in-game blueprint tester.

## What it found

**Empty mass is exactly the bill of material:**

```
operatingEmptyMass = Σ(component weight × count)
```

87 of 87 blueprints, max residual `2.3e-13 t`. No baseline term, no hull offset.

The real blocker was `totalVolume` — the hull-envelope figure the game computes and then uses to size the hull plating and structural components. It is **not** the sum of component volumes (0 of 87), not `storeCapacityVolume`, and has no constant packing factor (volume-sum ÷ totalVolume ranges 0.725–2.015). It is additive over five of the twelve fields, dominated by the cargo bay's **m³ capacity**:

```
totalVolume = 438 + 1.05 × cargo_capM3 + engineΔ + stlTankΔ + reactorΔ + ftlTankΔ
```

86 of 87 within 0.5% (79 exact). With volume known the rest follows: plates `round(0.535·V^0.655)`, SSC `round(0.0478·V)`, crew quarters by volume band, command bridge by FTL-reactor tier — and therefore exact empty mass.

Seven of the twelve fields (hull plates, all four shielding types, drone, seats) have **zero** effect on volume. Hull plates are two independent knobs: you pick the *type* (weight per plate), the game picks the *count* (from volume) — so Lightweight over Reinforced saves 288–930 t with no other change.

**Methodological warning:** a regression over these fields is confounded and returns confidently wrong coefficients (R²=0.992 while reporting the Quick-Charge reactor at −77 m³ when the true value is +7). Every delta here was measured from **controlled one-field-change blueprint pairs**, not a fit.

Shipped into the planner (commit `7c74e80`): volume 86/87 within 1% (mean 0.002% over the 86 non-vortex ships; the single miss is the vortex ship BP-CLNY-0000), mass 82/86 within 1% (mean 0.199%).

## Files

| File | Audience |
|------|----------|
| `OPENMASS_SUMMARY_2026-07-18.md` | Full peer write-up — chronology, failed approaches, every number sourced |
| `OPENMASS_findings_public_2026-07-18.md` | Repo / community technical write-up |
| `OPENMASS_post_channel.md` | Discord flight-channel post |

### Scripts and outputs

| Script | Output | What it does |
|--------|--------|--------------|
| `build_master.js` | `blueprints_master.json`, `blueprints_master_index.json` | Normalises the capture into one record per blueprint — volume, OEM, BOM, the 12 selections, derived counts |
| `volume_formula_validation.js` | `volume_formula_validation.txt` | **The headline result** — scores `438 + 1.05×capM3 + Δ` against all 87 |
| `mass_chain_validation.js` | `mass_chain_validation.txt` | Scores the full volume → counts → mass chain (86 non-vortex) |
| `ssc_analysis.js` | `ssc_analysis.txt` | Which of the 12 fields move volume/SSC, from one-field-change pairs |
| `forward_predict.js` | `forward_prediction.txt` | Earlier stage — mass from a *known* volume, before the volume law was found |
| `build_lookup.js` | `lookup_table.json`, `lookup_report.txt` | The 61-combo lookup kept as the planner's secondary cross-check |
| `fixed_mass_check.js` | `fixed_mass_check.txt` | Size-independence of the non-scaling mass |
| `find_scaling_components.js` | `scaling_check.txt` | Which BOM entries scale with volume |
| `read_blueprints.js` | `blueprint_dump.txt` | Raw frame reader |
| — | `ridge_output.txt` | The **failed** ridge fit and its collinearity analysis — kept as the evidence for the regression warning |
| — | `fit_output.txt`, `fix_output.txt`, `corrected_audit.txt`, `volume_test.txt`, `selections_audit.txt` | Intermediate audits from the failed-approach phase |
| — | `feature_matrix*.csv` | Feature matrices (raw BOM, selections-only, and the corrected 12-field build) |
| — | `capture_checklist.txt`, `checklist_print.txt` | The build-by-build capture plan drawn up to break the collinearity |

Scripts read the corpus from `prun-openmass/` by absolute path — see below.

## Data sources

- Blueprint corpus: `prun-openmass/blueprint_data.jsonl` — 87 distinct blueprints from `BLUEPRINT_BLUEPRINTS` frames, each with `performance.totalVolume`, `performance.operatingEmptyMass`, full `billOfMaterial.quantities[]` and the player's `selections[]`. A strict superset of the earlier 44-blueprint `prun-landing/LNG_TEST_TIME_3/blueprint_data.jsonl`.
- Analysis scripts and outputs: included in this folder (see table above). They read `blueprint_data.jsonl` from `C:\prun-tools\prun-openmass\` by absolute path, so point that constant at your own copy of the corpus to re-run them.
- Implementation: `prun-toolset/public/prun_flight_planner.html` — `computeTotalVolume()`, `computeEmptyMass()`, `STRUCT_COUNT`, `COMPONENT_DATA`

## Open

Exact rounding rule for plate/SSC counts (±1 today, and the counts are deterministic, so a boundary rule exists). The **vortex drive** — one sample only, on the largest hull captured, with no standard FTL reactor; suspected volume-triggered above the Hyper-Power ceiling (threshold between 6,242 and 8,532). Crew-quarters band cutoffs sit in unsampled gaps. Emitter counts follow no pinned rule (small mass, carried as a nominal).

## Credits

**Marcus Licinius Crassus** — flight-dynamics and ephemeris work the planner rests on, and the confirmation that in-flight mass is `OEM + 0.06×STL_units + 0.05×FTL_units + payload`, which identified empty mass as the quantity to solve. **Taiyi Bureau** — universe map and galaxy data. **Raylu** (`git.raylu.net/raylu/pruncalc`) — ship repair calculator and component handling. **SAGANAKI** — FIO galaxy star/system data. Corpus, controlled-pair method, volume law and implementation by EoinCuinn with Claude Code.
