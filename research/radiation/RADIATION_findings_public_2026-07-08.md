# Radiation Damage — Findings and Open Questions

*Blueprint-tester capture study, shared to the flight-discussion channel — 2026-07-08, by EoinCuinn*

This writes up everything I've measured on radiation damage so the numbers are on the table for everyone who's worked on this. It's built on in-game blueprint-tester flights (deterministic damage, ~5e-9 repeatable) plus Aem's spreadsheet and Raylu's repair calculator for comparison. It agrees with some of the prior community work and disagrees with some of it; both are called out explicitly, with the numbers, so anyone can check or push back. The intent is to add to the shared picture, not to overturn it — most of what's here rests on foundations Aem, Raylu and others built. The galaxy star/system data used throughout — per-system luminosity and meteoroid density — comes from FIO (fnar.net), submitted by SAGANAKI; thanks for gathering and sharing it.

Two conventions up front, because they matter for reconciling numbers. In the captured flight payloads, `stlDistance` is in kilometres — confirmed because the WX-827a intra-system transit's `stlDistance` of 3.017e10 works out to 201.7 AU (÷ 1.496e8 km/AU), a sensible cruise, whereas reading it as metres would make that leg 0.2 AU. So distance in millions of km is `distMkm = stlDistance / 1e6`, the same convention under which the meteoroid formula reproduces observed damage. And Aem's radiation formula outputs percent-per-Mkm while the flight payload's `damage` is a fraction, so Aem's numbers are ÷100 to compare.

---

## Headline

Radiation-like damage is real on sublight legs near a hot star: damage per unit distance rises with proximity to the star as approximately the inverse square of orbital radius — Aem's functional form — demonstrated on two independent ships in one O-class system, with a control that rules out a flight-length artefact. Separately, the Specialised Anti-Radiation Plate shows no measurable effect in any controlled capture I have, including the leg where that radiation excess is 84% of the damage. So radiation exists and the plate marketed to reduce it does nothing I can measure — that contradiction is the central open problem. And the community's two prior treatments each capture part of the picture: Aem's inverse-square shape is confirmed, but his two tabs disagree on the absolute constant by ~10×, and Raylu's repair calculator assumes a radiation channel rather than measuring one.

---

## 1. The decisive experiment: NL-534 orbital-radius sweep

NL-534 is O-class, luminosity 1636, and the lowest-meteoroid-density O/B system reachable (density 2.004). I flew intra-system TRANSIT legs between planet pairs at increasing orbital radius — a→b (inner, ~1.98 AU), c→d (~6.12 AU), e→f (further), g→h (outermost, toward 253 AU) — on two independent ships. Ship 1 was flown with and without the Specialised plate at matched slider on every leg. Ship 2 (blueprint BP-VWVB-2566, +100% Whipple, 0% radiation shielding) repeated the legs unshielded and added the key control: an a→h leg that covers the same total distance as g→h but dives inward to 1.98 AU.

Damage per Mkm is `damage / (stlDistance / 1e6)`.

**Ship 1, unshielded:**

| Leg | stlDistance (km) | damage | damage/Mkm |
|-----|------------------|--------|------------|
| a→b | 804494238.6 | 0.06579615 | 8.17857e-5 |
| c→d | 2373148407.3 | 0.04691965 | 1.97711e-5 |
| e→f | 7374432104.1 | 0.10094517 | 1.36885e-5 |
| g→h | 39542648485.9 | 0.52371531 | 1.32443e-5 |

**Ship 1, Specialised plate fitted:**

| Leg | stlDistance (km) | damage | damage/Mkm |
|-----|------------------|--------|------------|
| a→b | 804098132.7 | 0.06576520 | 8.17875e-5 |
| c→d | 2372851069.4 | 0.04691400 | 1.97712e-5 |
| e→f | 7374518981.7 | 0.10094636 | 1.36885e-5 |
| g→h | 39542615855.3 | 0.52371488 | 1.32443e-5 |

**Ship 2, unshielded (+100% Whipple), including the a→h control:**

| Leg | stlDistance (km) | damage | damage/Mkm |
|-----|------------------|--------|------------|
| a→b | 796121281.0 | 0.05919164 | 7.43500e-5 |
| c→d | 2364298328.3 | 0.04249376 | 1.79731e-5 |
| e→f | 7385767628.0 | 0.09190944 | 1.24441e-5 |
| g→h | 39515927245.6 | 0.47578310 | 1.20403e-5 |
| a→h | 38794151180.0 | 0.50962882 | 1.31367e-5 |

**What this shows.** Ship 1's damage/Mkm falls 6.2× from the innermost leg to the outermost floor. Treating the outermost leg as the meteoroid-plus-base floor, the a→b excess is 8.17857e-5 − 1.32443e-5 = 6.854e-5, which is 84% of that leg's damage. The c→d excess is 6.527e-6. The ratio of those excesses is 10.50; the square of the orbital-radius ratio (6.12/1.98) is between 9.5 and 10.9 depending on the effective radius of each hop — so the excess scales as ~AU⁻², Aem's form. By e→f the excess is down to ~3% above floor. Ship 2 reproduces the same shape independently (a→b excess again ~84% of the leg), and its heavier Whipple lowered the meteoroid floor (1.204e-5 vs Ship 1's 1.324e-5) while leaving the radiation excess essentially unchanged — so meteoroid and radiation are separate channels and the radiation coefficient is close to ship-independent.

The a→h control is what makes this conclusive rather than suggestive. a→h and g→h are the same length (38794 vs 39543 Mkm), yet a→h takes 1.31367e-5/Mkm against the g→h floor of 1.20403e-5 — 9.1% more — solely because it dives to 1.98 AU. Same distance, more damage, because of proximity to the star. Adjacent-planet hops can't separate radius from length; this does.

**Coefficient.** Extrapolating Ship 1's a→b excess back to 1 AU under the inverse-square law gives roughly 0.046 %/Mkm for this O-class star — within ~1.6× of Aem's KQ-451-tab coefficient (0.0734 %/Mkm), and ~17× below his generalised Sunlight-tab constant (which for this luminosity predicts ~0.80 %/Mkm). Our capture backs the KQ-451 tab and not the generalised one.

---

## 2. I can't detect any effect from the plate

Across every controlled comparison of the Specialised Anti-Radiation Plate against no plate I measure no reduction — and the keystone is one test where I independently confirmed the plate was physically fitted, not just labelled.

That keystone is the NL-534a approach test. There the plate registered as a +2 stlFuel (mass) signature at matched slider — base fuel 204 with the plate versus 202 without — so it was demonstrably equipped. Damage-per-metre was 1.4020e-10 in both states, identical; the plate cut nothing.

Every other plate-labelled capture agrees. On the NL-534 sweep above, Ship 1 plate-on vs plate-off is identical to 5–6 significant figures on every leg — 8.17875e-5 vs 8.17857e-5 at a→b (the plate leg is fractionally *higher*, i.e. noise), and identical at c→d, e→f, g→h — including that a→b leg where 84% of the damage is the radiation excess. One honesty note on the sweep: the plate's 15 t on a ~1844 t ship is below fuel resolution on these long legs, so the sweep by itself rests on the file labelling rather than an independent mass check — but it is consistent with the confirmed NL-534a result. A residual test on WX-827a/GH-459c/VH-331a transits gave plate-on-minus-plate-off differences of −7.16e-7, −1.35e-7 and +1.99e-7, all indistinguishable from zero. The only apparent plate effect anywhere in the data is in my earliest, least-controlled approach captures at CG-021 and XG-452, where the 15 t offset meant the two runs never shared a slider.

**The paradox:** the same clean NL-534 dataset shows radiation is real and large, and shows the plate doesn't touch it — even on the flight where the plate was confirmed fitted. Either the plate is inert or bugged in the current game, or it acts on a quantity these captures don't measure. I can't tell which, and I'm not asserting the plate is worthless as a certainty — I'm reporting that I can't detect it working, on the cleanest tests I could design. A single capture from anyone showing the plate measurably lowering damage — or showing where my setup is wrong — would resolve it, and it is the most valuable thing anyone could add.

---

## 3. Meteoroid is the rest of transit damage

For context on why radiation is hard to see except close to a hot star: the meteoroid formula from the flight planner (`damage = 7.1692e-6 × (stlDistance/1e6) × density^(0.683 + 0.223·log10 density)`) reproduces WX-827a transit at a predicted mean of 0.5243 against observed 0.5753 — an 8.9% under-prediction, systematic across all eight segments. So meteoroid explains ~91% of that transit and radiation there is a low-single-digit percent, below detection. Radiation only rises above the meteoroid floor when you're close to a hot star, which is exactly why the NL-534 close-in legs are where it shows.

---

## 4. Where this meets the prior community work

**Aem's spreadsheet.** Aem's inverse-square shape is confirmed by the NL-534 sweep — independently of his data, on two ships, with the length control. That's the strongest corroboration his form has. Two honest points, though. His two tabs disagree on the absolute constant by ~10.6× (the generalised Sunlight tab implies ~0.78 %/Mkm at 1 AU for KQ-451's luminosity; the KQ-451 tab's own fit gives 0.0734), and my O-class capture agrees with the KQ-451 tab and not the generalised one. And the shielded column on the KQ-451 tab is a computed column — the shielded value is the unshielded value × 0.305 in the cell formula — so the sheet doesn't contain an independent measurement of the plate reducing damage; the 70% is an input, not a measured output. None of that is a knock on the work — the KQ-451 flights are real and the form is right — it just means the plate's effectiveness is still untested and the constant needs pinning. Aem: which tab do you now treat as canonical?

**RNGzero's repair calculator (shared by Raylu).** The calculator decomposes each preset trip into Wear + Meteor + Heat + Radiation channels and hard-codes the Specialised plate as ×0.7 on the radiation channel. For the ANT → Ice Station preset it assigns a radiation share of roughly 18–19% of the trip. A note on the sheet says the preset trips were "calculated in BLU using a HCB ship," so the channel splits are modelled rather than measured plate deltas. The thing I can't square is that share against the star: SE-110 (Thalassa) is M-class, luminosity 0.00204 — the dimmest class — where any inverse-square model puts radiation at a fraction of a percent of the trip, not 18%. (I also flew the route plate-on vs plate-off and saw no difference, but I'd put little weight on that alone — an M-star route is a weak plate test, since there's almost nothing to shield there regardless.) So the open question is how the 18% channel was derived. Raylu — genuinely asking, not needling: if that fraction came from measured plate deltas somewhere, that's exactly the counter-data I'm looking for.

---

## 5. Open questions

**The plate paradox** — radiation is real and inverse-square, the plate reduces it by zero in every controlled capture. Cause unknown. Highest-value thing to resolve.

**The absolute constant** — pinned only by one O-class system so far (~0.046 %/Mkm at 1 AU), agreeing with Aem's KQ-451 tab to ~1.6× and disagreeing with his generalised tab by ~17×. Needs a second hot star before anyone hard-codes it.

**Cross-system luminosity scaling** — this one's a genuine puzzle. Two near-identical B-class stars, CG-021 (lum 142.9) and LS-231 (lum 157.1), at basically the same orbital radius (~1.0 AU), gave radiation differing by ~2500× in my early approach captures, which were the least controlled. If that holds up, luminosity alone doesn't set the coefficient and there's a per-star or per-system property missing. Has anyone else seen radiation vary between similar stars like this?

---

## 6. The experiment that would close most of this

A plate-on vs plate-off, matched-slider sweep at 2–3 known radial distances around a *second* hot star — ideally a B-class like NH-555 (lum 149) plus one more O like XG-452 or AM-528 — capturing intra-system TRANSIT legs long enough to clear the determinism floor (even a 1 Mkm leg does). Two hot stars of different luminosity at known radii would pin the absolute constant, test whether it really scales with luminosity or fails the way the CG-021/LS-231 pair suggests, and give the plate its single cleanest test at the radius where radiation dominates. Damage is deterministic to ~5e-9, so it's not noise-limited — it just needs the right legs flown. As far as I know nobody's run that specific sweep yet, and it's the highest-value capture remaining.

Happy to share raw numbers, the meteoroid/orbital constants, or the per-leg captures with anyone who wants to reproduce or poke holes.
