# Open Mass Workstream — Complete Summary

**Prepared for:** Marcus Licinius Crassus
**Prepared by:** EoinCuinn, with analysis by Claude Code
**Date:** 2026-07-18
**Working directory:** `C:\prun-tools\prun-toolset\` (planner) and `C:\prun-tools\prun-openmass\` (captures, scripts, outputs)

---

## Purpose and headline

This document records the derivation of a ship's **empty mass** and **hull volume** from nothing but the twelve components a player selects in the blueprint designer. The goal was practical: the flight planner's Hypothetical mode lets you build a ship from dropdowns, and it needs the same `operatingEmptyMass` the in-game blueprint tester would produce, because empty mass feeds acceleration, and acceleration feeds every fuel and flight-time number downstream. Until this workstream it did not have it.

The corpus is **87 distinct blueprints** captured from `BLUEPRINT_BLUEPRINTS` frames (`prun-openmass/blueprint_data.jsonl`), each carrying `performance.totalVolume`, `performance.operatingEmptyMass`, the full `billOfMaterial.quantities[]`, and the `selections[]` the player made.

Four headline conclusions.

First, **empty mass is exactly the bill of material**: `operatingEmptyMass = Σ(component weight × count)` over the full BOM, including the parts the game adds for you. This holds on **87 of 87** blueprints with a maximum residual of `2.3e-13 t` — floating-point noise, not error. There is no baseline term, no hull offset, no crew or consumables fudge. This single fact retired two long-standing "corrections" in the planner's notes (an "LCB at 1456.2 t" and an "RHP −477 t hull baseline"), both of which turned out to be misreadings of earlier fitted aggregates rather than real physics.

Second, and this was the actual blocker: **`totalVolume` is not any simple reduction of the loadout.** It is not the sum of the components' own volumes (0 of 87 match; residuals run from −3,088.8 to +205.5, and the ratio of volume-sum to `totalVolume` swings from 0.725 to 2.015), and it is not `storeCapacityVolume`. Because the game sizes the hull plating and structural components *from* `totalVolume`, and those parts then contribute their own volume, the quantity is a fixed point rather than an accumulation.

Third, **`totalVolume` is additive over exactly five of the twelve selectable fields**, and the cargo term is driven by the bay's **volume capacity in m³**, not by the bay's own component volume and not by its tonnage capacity:

```
totalVolume = 438 + 1.05 × cargo_capM3 + engineΔ + stlTankΔ + reactorΔ + ftlTankΔ
```

This reproduces **86 of 87** blueprints to within 0.5% (79 exactly). The single miss is the one vortex-drive ship, whose drive is not one of the twelve fields.

Fourth — and this is the methodological point worth the most to anyone repeating this work — **regression across these fields is confounded and produces confidently wrong coefficients.** A ridge fit over the five volume fields returned R²=0.992 and a Quick-Charge-reactor coefficient of **−77**; the true value, measured from a controlled pair, is **+7**. The fields co-vary in any naturally-collected corpus, so the fit smears their effects together. Every delta quoted here was measured from **clean one-field-change pairs** — two blueprints identical in the other four volume fields — not from a fit.

---

## 1. What was tested, in chronological order

### 1.1 Corpus survey and the empty-mass identity (2026-07-18)

All `BLUEPRINT_BLUEPRINTS` captures across the tree were catalogued and pooled. `prun-openmass/blueprint_data.jsonl` proved to be a strict superset containing all 87 unique blueprints; the earlier `prun-landing/LNG_TEST_TIME_3/blueprint_data.jsonl` (44) is wholly contained in it. Summing `weight × amount` over each blueprint's BOM and comparing to `operatingEmptyMass` gave the identity in §2.1.

### 1.2 Three failed model attempts (recorded because they shaped the method)

Three approaches were tried and abandoned, in order:

1. **Ridge regression on BOM component counts.** In-sample R²=1.000 but the design matrix was rank 45 of 60. Ten-fold cross-validation failed: mean 2.41% error, worst **−83.97%** on `BP-CLNY-0000`, held-out R²=0.794. The in-sample perfection was an artefact — the BOM includes the hull-plate and SSC counts, which are themselves derived from `totalVolume`, so the model was predicting volume from volume.
2. **Regression on the full `selections[]` set.** Removing the derived columns and using only user selections gave a better picture of the design space (76 of 87 within 2%, and 0.27% mean on builds using only well-sampled options) but still failed overall: mean 5.40%, worst 126.5%, held-out R²=0.735, with the failures concentrated on options captured ≤3 times.
3. **Restricting to the twelve selectable fields alone.** This failed hardest — mean 18.5%, worst 307% — and, decisively, failed *in-sample* (4.94% mean, only 36 of 87 within 2%). An in-sample failure cannot be undersampling, which ruled out "capture more blueprints" as the fix and forced the search for a structural rule instead.

A fourth dead end is recorded in the repository history rather than here: a manual `totalVolume` input field was briefly shipped to Hypothetical mode as a workaround (commit `26da03a`) and reverted three days later (commit `990ba8c`) once it was clear it was a UI patch over an unsolved model.

### 1.3 Structural-component analysis (2026-07-18)

Every component's count was correlated against `totalVolume`, isolating the two that scale with it (hull plates and `SSC`). Each of the twelve fields was then tested for its effect on the SSC count using single-field-difference blueprint pairs.

### 1.4 Controlled one-field-change sweeps (2026-07-18)

The corpus was grouped so that pairs differing in exactly one of the five volume-driving fields — with the other four held fixed — could be extracted, and `ΔtotalVolume` read directly off each pair. This is the instrument that produced every delta in §2.4, and it is what the regression in §2.5 got wrong.

### 1.5 Implementation and validation (2026-07-18)

`computeTotalVolume()` and `computeEmptyMass()` were implemented in `public/prun_flight_planner.html` and wired into `rebuildHypo()` (commit `7c74e80`). The shipped functions were then extracted back out of the HTML and run against the capture corpus, so the validation exercises the deployed code rather than a reimplementation of it.

---

## 2. What was found, with numbers

### 2.1 Empty mass is the bill of material, exactly

`operatingEmptyMass = Σ(weight × count)` over the full BOM: **87 of 87**, maximum absolute residual **2.3e-13 t**. No baseline, no offset.

The two "known problem cases" carried in the planner's notes both dissolved. The "LCB listed at 1456.2 t versus a real BOM weight of ~200 t" was not a component weight at all — 1456.2 t is the whole-ship `operatingEmptyMass` of `BP-UJUA-7750`, which an earlier fitted aggregate had absorbed into the cargo-bay entry; `largeCargoBay` weighs **200 t**. The "RHP hull baseline wrong, −477 t offset" was likewise an artefact: since empty mass is exactly the BOM sum, no baseline exists to be wrong. `reinforcedHullPlate` weighs **10 t** and is a per-plate weight, not a per-ship constant.

### 2.2 `totalVolume` is not a reduction of the parts

Tested and rejected on all 87: `totalVolume ≠ Σ(component volume × count)` (0 of 87; residual range −3,088.8 to +205.5) and `totalVolume ≠ storeCapacityVolume` (0 of 87). The ratio of the component-volume sum to `totalVolume` ranges **0.725 to 2.015** — small ships enclose less volume than their parts sum to, large ships roughly double it — so no constant packing factor exists either.

### 2.3 Only five of the twelve fields move volume

Using single-field-difference pairs, each field was tested for its effect on the SSC count (which tracks `totalVolume`):

| Field | isolated pairs | SSC changed | verdict |
|---|---|---|---|
| STL engine | 170 | 50 | affects |
| STL fuel tank | 34 | 34 | affects |
| FTL reactor | 74 | 73 | affects |
| FTL fuel tank | 35 | 33 | affects |
| Cargo bay | 160 | 159 | affects |
| Hull plates | 92 | **0** | no effect |
| Heat / Whipple / Stability / Radiation / Drone / Seats | 34 / 34 / 16 / 54 / 33 / 37 | **0 each** | no effect |

Seven fields have **zero** effect across many isolated pairs. Grouping by the five that do gives 37 distinct combinations with **no** SSC variation inside any of them — the five fields fully determine it. The seven that don't are the ones that add hull-surface or fitted mass without enlarging the internal envelope.

### 2.4 The volume law, measured from controlled pairs

Cargo is the dominant term and is driven by the bay's **m³ capacity**. The decisive evidence is the pair of "off-diagonal" bays: `highLoadCargoBay` (3,000 t / 1,000 m³) and `mediumCargoBay` (1,000 t / 1,000 m³) produce **identical** `totalVolume` (1,488), identical SSC (71) and identical plate count (64) on the same profile, despite differing in weight and tonnage capacity; `highVolumeCargoBay` (1,000 t / 3,000 m³) lands at 3,588. Across all eight bays on a fixed profile, `totalVolume = 438 + 1.05 × capM3` fits every one to the integer.

The remaining four fields, measured as `ΔtotalVolume` from pairs with the other four volume fields held fixed:

| Field | Deltas (m³) |
|---|---|
| STL fuel tank | Small 0 · Medium **+126** · Large **+410** |
| FTL reactor | Standard 0 · Quick-Charge **+7** · High-Power **+117** · Hyper-Power **+127** · none **−126** |
| FTL fuel tank | Small 0 · Medium **+6** · Large **+18** · none **−3** |
| STL engine | Standard 0 · Advanced **+3** · Glass **−1** · Fuel-Saving **−1** · Hyperthrust **+7** |

Assembled, `totalVolume = 438 + 1.05 × capM3 + engineΔ + stlTankΔ + reactorΔ + ftlTankΔ` predicts **86 of 87** blueprints within 0.5%, **79 exactly**. The `1.05` is not a fudge: it is the structure feedback — cargo capacity demands space, and the plates and SSC added to enclose that space themselves occupy roughly a further 5%.

### 2.5 The confounding result — why the deltas are not from a fit

A ridge regression over the same five fields, on the same 87 blueprints, returns R²=0.992 and *plausible-looking* coefficients that are wrong. It reports the Quick-Charge reactor at **−77 m³** where the controlled pair gives **+7**, and "no FTL tank" at **+770 m³** where the pair gives **−3**. The fields co-vary in the corpus — bigger cargo tends to come with bigger tanks and stronger reactors — so a fit distributes one field's effect across its correlates. A high R² provided no protection against this. The controlled-pair deltas, by contrast, are internally consistent across every profile group in which they appear (the only wobbles are ±1, from integer rounding), and the reactor value `+7` was independently confirmed against `BP-XURB-5377`, a ship identical to the reference profile except for its reactor.

### 2.6 What falls out of `totalVolume`

With volume known, the rest of the ship follows:

- **Hull-plate count** = `round(0.535 × V^0.655)` — exact on 69 of 87, ±1 otherwise.
- **SSC count** = `round(0.0478 × V)` — exact on 68 of 87, ±1 otherwise.
- **Crew quarters** by volume band, from four non-overlapping ranges: CQT 543–837, CQS 962–1,614, CQM 2,538–2,671, CQL 2,803–8,532 (weights 12.5 / 25 / 50 / 75 t).
- **Command bridge** by FTL-reactor tier: no reactor → `BRS` (150 t), Standard or Quick-Charge → `BR1` (180 t), High-Power or Hyper-Power → `BR2` (280 t). This was the last piece; defaulting the bridge to `BR1` had left a 10% worst-case mass error, and the tier rule removed it.
- **FTL field controller** present iff an FTL reactor is fitted (50 t).

### 2.7 Hull plates are two independent knobs

Worth separating because it is a genuine build lever. The player picks the plate **type**, which sets the weight per plate (Lightweight 4 t, Basic 9 t, Reinforced / Advanced / Hardened 10 t). The game picks the **count**, purely from `totalVolume`. The count is type-independent — at `V=963` every plate type yields exactly 48 plates, at `V=1,095` every type yields 52 — and all five types have the same unit volume (10), so the type does not move `totalVolume` at all. Plate mass is therefore `count(V) × weight(type)`, and choosing Lightweight over Reinforced strips 288 t off a 48-plate ship and 930 t off a 155-plate one, with no other change. (The trade is durability and g-tolerance, which this workstream does not address.)

### 2.8 Shipped result

`computeTotalVolume()` / `computeEmptyMass()` in `prun_flight_planner.html`, commit `7c74e80`, validated by extracting the shipped functions and running them over the corpus:

- **Volume: 86 of 87 within 1%** (mean 0.002% over the 86 non-vortex ships, max 0.07%; the single miss is the vortex ship BP-CLNY-0000)
- **Mass: 82 of 86 within 1%** (mean 0.199%, max 1.35%)

Spot checks: `BP-EBKR-1418` +0.61%, `BP-CXHG-6746` +0.08%, `BP-WIYN-8444` 0.00%, `BP-XURB-5377` −0.04%, `BP-UVUA-6284` −0.01%.

---

## 3. What remains open

**The ±1 rounding rule.** Plate and SSC counts are reproduced to ±1 but not exactly (52 of 87 have *both* exact). The counts themselves are deterministic — every ship at `V=963` has exactly 48 plates and 46 SSC — so the game's rounding boundary is a real, findable rule that our `round(0.535·V^0.655)` and `round(0.0478·V)` approximate. This is the sole source of the remaining mass error; four ships sit at 1.03–1.35%. Closing it needs a size ladder: sweep one volume field across its range with the other eleven fixed and read the count transitions.

**The vortex drive.** `BP-CLNY-0000` is the single vortex ship in the corpus and also the largest (`V=8,532`); it carries a Vortex Reactor and Vortex Fuel Tank and has **no** standard FTL reactor. The formula misses it by −49.7% because those parts, worth roughly 2,556 m³ once their structure cascade is counted, are outside the twelve fields. The working hypothesis — untestable on one sample — is that the vortex drive is itself **volume-triggered**, auto-fitted once a hull outgrows the top standard reactor: the largest non-vortex ship runs Hyper-Power at `V=6,242`, so any threshold lies between 6,242 and 8,532. Deliberately building an oversized hull and watching for the drive to appear is the experiment that would settle it.

**Threshold boundaries.** The crew-quarters bands are clean but their exact cutoffs sit in unsampled gaps (CQT→CQS somewhere in 837–962, CQS→CQM in 1,614–2,538, CQM→CQL in 2,671–2,803). The planner uses gap midpoints. Likewise the bridge tier rule rests on 78 `BR1`, 7 `BR2` and 2 `BRS` ships — clean, but thin at the edges.

**Emitters.** FTL field-emitter counts vary with size but no rule has been pinned. Their mass contribution is small (~0.5–2.8 t), so the planner carries a nominal 1.5 t; this is an acknowledged approximation, not a derived value.

**Causation versus correlation on the auto-fitted parts.** Crew quarters track `totalVolume` across four non-overlapping bands, which is strong, but quarters house crew — so the true trigger could be a crew-capacity requirement that itself tracks volume. Nothing in this corpus separates the two.

---

## Credits

**Marcus Licinius Crassus** — the flight-dynamics and ephemeris work the planner rests on, and the confirmation (2026-07-15) that in-flight mass is `OEM + 0.06 × STL_units + 0.05 × FTL_units + payload`, which is what made empty mass the right quantity to chase rather than a loaded-mass proxy. **Taiyi Bureau** — universe map and galaxy data. **Raylu** (`git.raylu.net/raylu/pruncalc`) — the ship repair calculator and its component handling. **SAGANAKI** — FIO galaxy star/system data. The blueprint corpus, the controlled-pair method, the volume law and the implementation were done on own capture data by EoinCuinn with Claude Code; scripts and outputs are in `prun-openmass/`.
