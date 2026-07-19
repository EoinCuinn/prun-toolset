# Ship Empty Mass & Hull Volume — Findings and Open Questions

## Headline

A ship's `operatingEmptyMass` is **exactly** the sum of its bill of material: `Σ(component weight × count)`, holding on all 87 captured blueprints to floating-point precision. No baseline, no hull offset.

The hard part was never mass — it was `totalVolume`, the hull-envelope figure the game computes and then uses to decide how many hull plates and structural components your ship gets. `totalVolume` is **not** the sum of the components' volumes and not the cargo capacity. It turns out to be additive over five of the twelve selectable fields, dominated by the cargo bay's **m³ capacity**:

```
totalVolume = 438 + 1.05 × cargo_capM3 + engineΔ + stlTankΔ + reactorΔ + ftlTankΔ
```

86 of 87 blueprints within 0.5% (79 exact). With volume known, the whole ship falls out — plate count, structural count, crew quarters, command bridge — and therefore so does exact empty mass.

Corpus: 87 distinct blueprints from `BLUEPRINT_BLUEPRINTS` captures, each with `performance.totalVolume`, `performance.operatingEmptyMass`, the full BOM and the player's `selections[]`.

---

## 1. Empty mass is the bill of material

`operatingEmptyMass = Σ(weight × count)` over every component, including the ones the game adds for you. **87 of 87**, max residual `2.3e-13 t`.

This retired two corrections that had been carried in the planner's notes for weeks, both of which were misreadings rather than physics:

- *"largeCargoBay is listed at 1456.2 t but really weighs ~200 t"* — 1456.2 t is the **whole-ship empty mass** of `BP-UJUA-7750`, which an earlier fitted aggregate had folded into the cargo entry. The bay weighs **200 t**.
- *"the reinforced-hull baseline is wrong by −477 t"* — there is no baseline. Empty mass is the BOM sum; `reinforcedHullPlate` is **10 t per plate**, and a ship carries however many plates its volume dictates.

## 2. `totalVolume` is not a reduction of the parts

Three hypotheses tested and rejected across all 87:

- `totalVolume = Σ(component volume × count)` — **0 of 87.** Residuals run −3,088.8 to +205.5.
- `totalVolume = storeCapacityVolume` — **0 of 87.**
- A constant packing overhead — no. The ratio of volume-sum to `totalVolume` swings from **0.725 to 2.015**: small ships enclose less than their parts sum to, large ships roughly double it.

The reason is circularity. The game sizes hull plating and structural components *from* `totalVolume`, and those parts then take up volume themselves — so it is a fixed point, not an accumulation.

## 3. Only five of the twelve fields move volume

Measured with single-field-difference pairs (two blueprints differing in exactly one field), tracking the structural count that follows volume:

**Affect volume:** STL engine, STL fuel tank, FTL reactor, FTL fuel tank, cargo bay.
**Zero effect:** hull plates (0 of 92 pairs), heat shielding (0/34), Whipple (0/34), stability (0/16), radiation (0/54), self-repair drone (0/33), high-G seats (0/37).

The seven that don't matter are the ones that bolt onto the hull surface or slot into existing space without enlarging the envelope. Grouping by the five that do gives 37 distinct combinations with zero structural-count variation inside any of them — those five fully determine it.

## 4. The volume law

**Cargo is driven by m³ capacity, not by the bay's own volume or its tonnage.** The clean evidence is two "off-diagonal" bays: `highLoadCargoBay` (3,000 t / 1,000 m³) and `mediumCargoBay` (1,000 t / 1,000 m³) give **identical** totalVolume (1,488), identical structural count and identical plate count on the same build — they differ in weight and tonnage but share m³. `highVolumeCargoBay` (1,000 t / 3,000 m³) lands at 3,588, tracking its m³ not its tonnes.

Deltas for the other four fields, each read off pairs with the remaining four volume fields held fixed:

| Field | Δ totalVolume |
|---|---|
| STL fuel tank | Small 0 · Medium +126 · Large +410 |
| FTL reactor | Standard 0 · Quick-Charge +7 · High-Power +117 · Hyper-Power +127 · none −126 |
| FTL fuel tank | Small 0 · Medium +6 · Large +18 · none −3 |
| STL engine | Standard 0 · Advanced +3 · Glass −1 · Fuel-Saving −1 · Hyperthrust +7 |

The `1.05` on cargo is the structure feedback: capacity demands space, and the plates and structure added to enclose it occupy roughly another 5%.

## 5. Methodological warning — do not fit this with a regression

This is the part most likely to save someone else time. A ridge regression over the same five fields on the same 87 blueprints returns **R² = 0.992** and coefficients that are confidently wrong:

- Quick-Charge reactor: fit says **−77 m³**. Controlled pair says **+7**. (Independently confirmed on `BP-XURB-5377`, a ship identical to the reference build except for its reactor.)
- "No FTL tank": fit says **+770 m³**. Controlled pair says **−3**.

The five fields co-vary in any naturally-collected corpus — bigger cargo arrives alongside bigger tanks and stronger reactors — so a fit distributes one field's effect over its correlates. The high R² gave no warning. Every number in §4 comes from controlled pairs, and they are internally consistent across every profile group they appear in, with only ±1 integer-rounding wobble.

Two earlier modelling attempts failed the same way for related reasons: a fit on raw BOM counts scored R²=1.000 in-sample but collapsed in cross-validation (worst −83.97%) because the BOM contains the volume-derived plate and structural counts — it was predicting volume from volume. A fit restricted to the twelve fields failed even *in-sample* (4.94% mean), which ruled out "collect more data" as the fix and forced the search for a structural rule.

## 6. What falls out once volume is known

- **Hull plates** = `round(0.535 × V^0.655)` — exact on 69 of 87, ±1 otherwise
- **Structural components (SSC)** = `round(0.0478 × V)` — exact on 68 of 87
- **Crew quarters** by volume band (non-overlapping): CQT 543–837 · CQS 962–1,614 · CQM 2,538–2,671 · CQL 2,803–8,532
- **Command bridge** by FTL reactor tier: none → BRS (150 t) · Standard/Quick-Charge → BR1 (180 t) · High/Hyper-Power → BR2 (280 t)
- **FTL field controller**: present iff an FTL reactor is fitted (50 t)

Then `operatingEmptyMass = Σ(weight × count)` and you have the ship.

**Hull plates are two separate knobs**, worth calling out as a build lever: you choose the plate *type* (weight per plate — Lightweight 4 t, Basic 9 t, Reinforced/Advanced/Hardened 10 t); the game chooses the *count*, purely from volume. The count is type-independent — at `V=963` every plate type gives exactly 48 plates — and all types share the same unit volume, so type doesn't move `totalVolume`. Going Lightweight instead of Reinforced strips 288 t off a 48-plate ship and 930 t off a 155-plate one, with nothing else changing. (The trade is durability and g-tolerance, not examined here.)

## 7. Open questions

**The exact rounding rule.** Plate and SSC counts land within ±1 but not exactly (52 of 87 have both exact). The counts are deterministic — every ship at `V=963` has 48 plates and 46 SSC — so there is a real boundary rule our `round()` approximations are missing. This is the only remaining source of mass error (four ships sit at 1.03–1.35%). A size ladder — sweep one volume field with the other eleven fixed — would pin it.

**The vortex drive.** One ship in the corpus (`BP-CLNY-0000`) carries a Vortex Reactor and Vortex Fuel Tank, has no standard FTL reactor, and is also the largest hull captured (`V=8,532`). The formula misses it by −49.7% because those parts sit outside the twelve fields. The working hypothesis is that the vortex drive is **volume-triggered** — auto-fitted once a hull outgrows the top standard reactor. The largest non-vortex ship runs Hyper-Power at `V=6,242`, so any threshold is between 6,242 and 8,532. One sample can't confirm it; building a deliberately oversized hull and watching for the drive to appear would.

**Threshold edges.** The crew-quarters cutoffs sit in unsampled gaps (CQT→CQS between 837 and 962, and so on); the planner uses gap midpoints. The bridge tier rule rests on 78 / 7 / 2 ships across the three bridges — clean, but thin at the edges.

**Emitters.** FTL field-emitter counts grow with size but follow no rule we've pinned. Mass impact is small (~0.5–2.8 t), so the planner carries a nominal 1.5 t — an acknowledged approximation.

**Correlation, not proven causation, on the auto-fitted parts.** Crew quarters track volume across four clean non-overlapping bands, but quarters house crew, so the real trigger may be a crew requirement that itself tracks volume. Nothing in this corpus separates those.

---

## Credits

**Marcus Licinius Crassus** — the flight-dynamics and ephemeris work the planner is built on, and the confirmation that in-flight mass is `OEM + 0.06 × STL_units + 0.05 × FTL_units + payload`, which is what identified empty mass as the right quantity to solve. **Taiyi Bureau** — universe map and galaxy data. **Raylu** (`git.raylu.net/raylu/pruncalc`) — ship repair calculator and component handling. **SAGANAKI** — FIO galaxy star/system data. Blueprint corpus, controlled-pair method, volume law and implementation by EoinCuinn with Claude Code; scripts and outputs in `prun-openmass/`.
