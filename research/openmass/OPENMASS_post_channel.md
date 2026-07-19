**Ship empty mass and hull volume — you can now compute both from the blueprint dropdowns**

Been chasing why the Hypothetical ship builder couldn't match the in-game blueprint tester. Turned out to be one missing quantity, and it's now solved. Numbers on the table because the method has a trap in it I'd like checked.

**Empty mass is just the bill of material.** `operatingEmptyMass = Σ(part weight × count)` over the full BOM, including the parts the game auto-adds. **87 of 87** captured blueprints, max residual 2.3e-13 t. No baseline term, no hull offset, no crew/consumables fudge. That also killed two "corrections" I'd been carrying: the "largeCargoBay weighs 1456.2 t" note was actually the *whole-ship* empty mass of another blueprint folded into the cargo entry (the bay is 200 t), and the "−477 t reinforced-hull baseline" doesn't exist — there is no baseline to be wrong.

**The actual blocker was `totalVolume`.** It's the hull-envelope figure the game computes and then uses to decide how many hull plates and structural components you get. It is **not** the sum of your parts' volumes (0/87 — residuals −3089 to +205), not `storeCapacityVolume`, and there's no constant packing factor (volume-sum ÷ totalVolume ranges 0.725 to 2.015). It's circular: plates and structure are sized *from* volume and then occupy volume themselves.

**The law — it's additive over 5 of the 12 fields, and cargo drives it by m³ capacity:**
```
totalVolume = 438 + 1.05 × cargo_capM3 + engineΔ + stlTankΔ + reactorΔ + ftlTankΔ
```
STL tank: Med +126, Large +410 · FTL reactor: Quick-Charge +7, High-Power +117, Hyper-Power +127, none −126 · FTL tank: Med +6, Large +18, none −3 · engine: ±a few. **86/87 within 0.5%, 79 exact.**

The cleanest proof that it's *m³ capacity* and not weight or tonnage: High-Load bay (3000 t / 1000 m³) and Medium bay (1000 t / 1000 m³) give **identical** totalVolume, SSC and plate count on the same build. High-Volume (1000 t / 3000 m³) tracks its 3000 m³. The 1.05 is structure feedback — capacity demands space, and the plates added to enclose it eat another ~5%.

**⚠ The trap — don't fit this with a regression.** A ridge fit over the same five fields on the same 87 blueprints gives **R²=0.992** and confidently wrong coefficients: it says Quick-Charge reactor is **−77 m³** when the true value is **+7**, and "no FTL tank" is **+770** when it's **−3**. The fields co-vary in any naturally-collected corpus, so a fit smears one field's effect across its correlates, and the high R² gives you no warning at all. Every delta above is measured from **clean one-field-change pairs** — two blueprints identical in the other four volume fields. Earlier attempts failed the same way: a fit on raw BOM counts scored R²=1.000 in-sample then collapsed in CV (worst −84%) because the BOM *contains* the volume-derived plate counts — it was predicting volume from volume.

**Once you have volume, the whole ship falls out:** plates = `round(0.535·V^0.655)` · SSC = `round(0.0478·V)` · crew quarters by volume band (CQT ≤837, CQS 962–1614, CQM 2538–2671, CQL 2803+) · command bridge by reactor tier (none→BRS, Standard/Quick-Charge→BR1, High/Hyper-Power→BR2) · FTL controller if an FTL reactor is fitted. Then sum the weights. Shipped into the planner: **volume 86/87 within 1% (mean 0.002% over the 86 non-vortex ships; the single miss is the vortex ship BP-CLNY-0000), mass 82/86 within 1% (mean 0.199%)**.

**One build lever worth knowing:** hull plates are two independent things — *you* pick the type (weight per plate: Lightweight 4 t, Basic 9 t, Reinforced/Advanced/Hardened 10 t), the *game* picks the count from volume. The count is identical across types (every ship at V=963 gets exactly 48 plates) and all types share the same unit volume, so the type doesn't change your volume at all. Going Lightweight over Reinforced drops **288 t** on a 48-plate ship and **930 t** on a 155-plate one, with nothing else moving. Obviously you're trading durability/g-tolerance for it — haven't touched that side yet.

**Still open:** the exact rounding rule for plate/SSC counts (we're ±1, and the counts are clearly deterministic, so there's a boundary rule to find); and the **vortex drive** — exactly one ship in my corpus has one, it's also the largest hull I've captured (V=8532), and it has no standard FTL reactor. Suspect it's volume-triggered once you outgrow Hyper-Power (largest non-vortex is 6242, so the threshold sits between those). Going to go build something stupidly large and watch for it.

Full write-up with every number sourced. Grateful as always for Marcus's flight-dynamics work — the confirmation that in-flight mass is OEM + fuel + payload is what pointed at empty mass being the right thing to solve in the first place.
