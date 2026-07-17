# Radiation Damage Workstream — Complete Summary

**Prepared for:** Marcus Licinius Crassus
**Prepared by:** EoinCuinn, with analysis by Claude Code
**Date:** 2026-07-08
**Working directory:** `C:\prun-tools\prun-dam-radiation\`

---

## Purpose and headline

This document consolidates every experiment, dataset and conclusion from the radiation-damage investigation into a single standalone record. It is written to be fair to all contributors and precise about what is measured versus assumed. Where a number is quoted it is taken verbatim from the source file or capture named alongside it.

The three headline conclusions, stated up front and defended below, are these. First, a radiation-like damage component is real: on intra-system sublight (TRANSIT) legs close to a hot star, damage per unit distance rises with proximity to the star in a way that is consistent with an inverse-square law in orbital radius, and this was demonstrated on two independent ships in one O-class system with a confound-breaking control. Second, the "Specialised Anti-Radiation Plate" is empirically non-functional: across every shielded-versus-unshielded pair we have captured — including the leg where the radiation component is 84% of the damage — the plate reduces damage by zero to five significant figures. Third, the community's two prior treatments of radiation (Aem's spreadsheet and Raylu's repair calculator) each capture part of the picture but neither is a clean, measured, shield-on/shield-off characterisation, and their absolute constants disagree with our captures and with each other by roughly one to two orders of magnitude.

A note on provenance and evolution. The handover documents on disk (`RADIATION_STATE.md`, `PrUn_Handover_2026-07-07.md`, `radiation_regression_brief_FINAL.md`) were written *before* the decisive NL-534 orbital-radius sweep and before the 2026-07-08 ANT→SE-110c plate test. Those earlier documents conclude "no radiation term / radiation is not observable." That conclusion was correct for the method available at the time — the shield-difference method — but was superseded once radiation was isolated as an orbital-radius-dependent excess in total damage rather than as a shield delta. This summary reflects the current, post-sweep state and supersedes the earlier handovers on the question of whether radiation exists.

A note on units, because it matters for the absolute constant. In the captured `SHIP_FLIGHT_MISSION` payloads, `segment.stlDistance` is in kilometres. This is confirmed by the WX-827a intra-system transit, whose `stlDistance` of 3.017e10 corresponds to 201.7 AU (3.017e10 km ÷ 1.496e8 km/AU), a physically sensible intra-system cruise; interpreting the same field as metres would make that leg 0.2 AU long, which is impossible for the planets involved. Throughout this document, distance in millions of kilometres is `distMkm = stlDistance / 1e6`, the same convention under which the meteoroid formula (coefficient 7.1692e-6) reproduces observed transit damage. Some intermediate scripts in this folder (`aem_vs_captures.js`, `wsc_final.js`) used `stlDistance / 1e9` instead; that 1000× difference does not affect any qualitative finding but is the largest single source of confusion in the absolute radiation constant and is flagged again in the open-questions section.

---

## 1. What was tested, in chronological order

### 1.1 APPROACH shield-difference campaign (2026-07-06)

The first campaign was built on the working hypothesis, inherited from Aem's method, that radiation damage lives in the APPROACH segment and can be isolated by flying the same route with and without the Specialised Anti-Radiation Plate and dividing the difference by the plate's stated 70% reduction. The ship was BP-KURM-2554 (base mass 1844 t; mass with the plate 1859 t; STL acceleration 54.2 m/s²), flown from Hortus Station (HRT, system VH-331). What varied was the shield state (none versus Specialised plate) and the fuel-slider position; what was measured was APPROACH-segment `damage` and `stlDistance`, with the destination planet always read from `segment.destination.lines[type=PLANET].entity.naturalId`.

The planets captured, with their star class and luminosity, were CG-021a/b/c/d (B, 142.90), XG-452a/c (O, 1681.89), AM-528a with waypoint IA-158b (O, 1669.65 / M, 0.0019), VH-192a (A, 25.01), UB-557a/c (F, 4.47), LS-231a/c (B, 157.11), and EY-430a/b (A, 24.48). The raw APPROACH extracts are in `two_files_extract.txt` and `xg452_extract.txt`; the matched-pair radiation table is `radiation_data_table.txt`; the fits are `radiation_formula_fit.txt` and `rad_regression_v2.txt`.

### 1.2 Channel localisation and correlation (2026-07-07)

To test the APPROACH assumption rather than assume it, all four capture files (`prun_rad_dam_noshield.jsonl`, 75 missions / 1630 segments; `prun_rad_dam_shield.jsonl`, 81 missions / 1580 segments; and the two WX-827/GH-459 files, 8 missions / 24 segments each) were flattened to 3258 segment rows (`radiation_flat.csv`) and correlated against the per-planet `Radiation` field from `all_planets.json`. This is reported in `radiation_correlation.txt` and `notes.txt`. Segment types present were APPROACH, DECAY, JUMP_GATEWAY, LANDING, LOCK, TAKE_OFF and TRANSIT.

### 1.3 Meteoroid verification on TRANSIT — "Workstream C" (2026-07-07)

Because the largest transit damage in the captures (WX-827a) was unaffected by the plate, the meteoroid formula from the flight planner source (`prun_flight_planner.html`, function `meteorDmgRaw`, lines 837-840) was run against the WX-827a TRANSIT to test whether that damage is meteoroid rather than radiation. Result file: `workstream_c_result.txt`. A companion test, `transit_residual_shield_test.txt`, subtracted predicted meteoroid damage from observed and asked whether the *residual* differs between shielded and unshielded runs.

### 1.4 Aem-model-versus-captures (2026-07-07)

Aem's radiation formula was evaluated against every TRANSIT segment in the captures, converting his percent-per-Mkm output to the fraction units of `segment.damage` by dividing by 100. Result file: `aem_model_vs_captures.txt`, with a re-run including the meteoroid term in `wx_gh_formula_rerun.txt`.

### 1.5 NL-534a O-class plate test on APPROACH (2026-07-07)

The first purpose-built O-class test: NL-534a (O, luminosity 1636, `Sunlight` 569529, 1.98 AU), flown with and without the confirmed Specialised plate, shield state identified independently of damage by the fuel/mass signature (the +15 t plate raises base STL fuel). Result file: `nl534_result.txt`; script `nl534_result.js`; source capture `prun-flight-capture\captures\nl534a_radiation.jsonl`.

### 1.6 NL-534 orbital-radius sweep with confound-breaker (decisive)

The decisive experiment. In the NL-534 system (O-class, luminosity 1636.49, `MeteoroidDensity` 2.004; the lowest-density O/B system reachable, per `candidate_systems.txt`), intra-system TRANSIT legs were flown between planet pairs at increasing orbital radius: a→b (inner, ~1.98 AU), c→d (~6.12 AU), e→f (further out), and g→h (outermost, toward 253 AU). Two independent ships were used. Ship 1 (files `NL_NOSIELD.json` and `NL_WITHSHIELD.json`) was flown with and without the Specialised plate at matched slider on every leg. Ship 2 (file `NL_BP2_Noshield.json`, blueprint BP-VWVB-2566, fitted with +100% Whipple shielding and 0% radiation shielding) repeated the four legs unshielded and added the critical control: an a→h leg that travels the same total distance as g→h but dives from the outer system in to 1.98 AU. Because a→h and g→h are the same length, any excess damage on a→h must come from proximity to the star, not from flight length — this breaks the confound between orbital radius and leg length that contaminates adjacent-planet hops.

### 1.7 ANT→SE-110c Specialised-plate test (2026-07-08)

The most recent test, prompted by the community researcher Raylu's claim that the Specialised plate is worth fitting specifically on the Antares-Station-to-Ice-Station-Alpha run. Two blueprint-tester captures on BP-VWVB-2566 over ANT (ZV-307, F) → ZV-639 (G, Roshar) → SE-110 (M, Thalassa) → SE-110c, one nominally with the plate and one without. Result file: `srp_ant_ice_report.txt`; source `ant_ice.json`.

---

## 2. What was found, with numbers

### 2.1 The APPROACH campaign produced a fit that does not generalise

The matched-pair APPROACH radiation values (`radiation_data_table.txt`), computed as `(no_shield − spec_shield) / 0.70`, showed a measurable signal only at the two O/B systems closest in. XG-452a (O, 1.7946 AU) gave no_shield 1.57653%, spec 0.61698%, radiation 1.370779%. XG-452c (O, 6.4564 AU) gave 0.24328% / 0.21185% / 0.044911%. The CG-021 hardcoded set gave CG-021a (1.0112 AU) 0.20720% / 0.11840% / 0.126857%, CG-021b (1.7282 AU) 0.11700% / 0.09130% / 0.036714%, and CG-021d (5.0764 AU) 0.08780% / 0.08420% / 0.005143%. Every mid- and low-luminosity planet returned radiation at or below the game's damage resolution: VH-192a 0.000150%, UB-557a 0.000147%, UB-557c 0.000011%, LS-231a 0.000047%, LS-231c 0.000055%, EY-430a −0.000137%, EY-430b 0.000032%.

The four-point fit (`radiation_formula_fit.txt`) gave `radiation = k × luminosity × AU^n` with k = 1.1545e-5, n = −1.9548, R² = 0.88834 in log space, and a near-constant non-radiation APPROACH floor of mean 0.14119% (standard deviation 0.06093%). The AU exponent near −1.95 is the one robust element of this fit and agrees with the earlier three-point CG-021 fit (k = 8.416e-6, n = −1.963).

The fit's own anomaly analysis is the important finding here, and it is documented in the same file. Cross-system luminosity scaling fails outright: CG-021a (B, luminosity 142.9, 1.011 AU) shows radiation 0.12686%, while LS-231a (B, luminosity 157.1, 0.988 AU) shows 0.00005% — nearly identical star class, luminosity and orbital radius, yet radiation differing by roughly 2500×. Fitting each system's own AU exponent gives −2.670 for XG-452 and −2.313 for CG-021, so a single universal exponent does not describe both. The conclusion recorded at the time was that luminosity is not the cross-system driver and the four-point fit is overfit. This warning stands and is revisited in section 5.

### 2.2 Channel localisation moved radiation off APPROACH

The correlation of the per-planet `Radiation` field against observed damage (`radiation_correlation.txt`) returned, by channel: APPROACH linear r = −0.0005 across 17 planets (no correlation); LANDING r = −0.1852 across 19 planets (no positive correlation, mechanical and mass-driven); JUMP_GATEWAY r = 0.7901 but resting on only four distinct planets with a near-flat exponent of 0.14, treated as spurious; and TRANSIT linear r = 0.9976 across 192 rows but only 28 with non-zero damage and only three distinct planets (VH-331a, GH-459c, WX-827a). The APPROACH result directly contradicted the inherited "radiation lives in APPROACH" assumption. The strongest apparent signal was on TRANSIT, but on only three planets, so it was flagged as promising and not robust.

### 2.3 Meteoroid explains the bulk of transit damage

Running `meteorDmgRaw` (k = 7.1692e-6, density exponent 0.683 + 0.223·log10(density), density floor 0.001) against the WX-827a TRANSIT with WX-827 `MeteoroidDensity` 3.1318 gave, over eight segments (`workstream_c_result.txt`), a predicted mean of 0.524262 against an observed mean of 0.575250 — a ratio of 0.9114, an 8.86% under-prediction. The under-prediction is systematic (predicted/observed = 0.911 on all eight segments, not random scatter), so meteoroid clearly dominates but does not fully close: an upper bound of roughly 9% of transit damage is left unexplained by the meteoroid term alone. The residual shield test (`transit_residual_shield_test.txt`) then compared that residual between shielded and unshielded runs: on WX-827a the no-shield-minus-shield residual difference was −7.163e-7, on GH-459c −1.353e-7, and on VH-331a +1.987e-7 — all indistinguishable from zero, meaning whatever the residual is, the plate does not remove it.

### 2.4 Aem's formula sits far below observed transit damage on our planets

Evaluated against observed transit damage (`aem_model_vs_captures.txt`, `wx_gh_formula_rerun.txt`), Aem's radiation term is a small fraction of what those particular legs actually take, because they are meteoroid-dominated. On WX-827a (B, 1.43 AU, ~30 Mkm under the `/1e9` convention that file used) Aem's unshielded radiation prediction of 1.06e-2 is 1.85% of the observed 5.75e-1. On GH-459c (K, 1.27 AU) it is 1.62% of observed. Only VH-331a, an M-class planet at 0.16 AU with almost no observed transit damage, showed Aem over-predicting (his radiation prediction exceeded the tiny observed value). The reading recorded at the time was that Aem's model is a radiation model, not a total-damage model, and that on B/K/M planets at 1–1.4 AU with high meteoroid density the radiation share stays below detection.

### 2.5 The Specialised plate does nothing at NL-534a APPROACH

The NL-534a O-class approach test (`nl534_result.txt`) is unambiguous. No-shield APPROACH damage-per-metre was 1.401912e-10 at low slider and 1.401324e-10 at high slider; with the plate the same figures were 1.401953e-10 and 1.401382e-10. The damage-per-metre is identical between shield states, and the total-damage differences of order 1e-6 track the tiny `stlDistance` differences exactly. Aem's formula predicted the plate should cut this approach by 1.00e-4 (his generalised constant) or 9.44e-6 (his KQ-451 constant); the observed reduction was approximately zero and the sign even flipped between sliders.

### 2.6 The NL-534 sweep: radiation is real and inverse-square, and the plate still does nothing

This is the decisive dataset. The table below gives, per leg, the exact `stlDistance` (km), the exact TRANSIT `damage` (a fraction of ship condition), and damage per Mkm computed as `damage / (stlDistance / 1e6)`. Ship 1 is shown in both shield states; Ship 2 unshielded, including the a→h control.

Ship 1 (unshielded, `NL_NOSIELD.json`):

| Leg | stlDistance (km) | damage | damage/Mkm |
|-----|------------------|--------|------------|
| a→b | 804494238.6021017 | 0.06579615428668707 | 8.17857e-5 |
| c→d | 2373148407.2738237 | 0.04691964914285553 | 1.97711e-5 |
| e→f | 7374432104.091339 | 0.10094516833779875 | 1.36885e-5 |
| g→h | 39542648485.936386 | 0.523715306885229 | 1.32443e-5 |

Ship 1 (Specialised plate, `NL_WITHSHIELD.json`):

| Leg | stlDistance (km) | damage | damage/Mkm |
|-----|------------------|--------|------------|
| a→b | 804098132.6832325 | 0.0657652013372131 | 8.17875e-5 |
| c→d | 2372851069.3787694 | 0.046913995672163325 | 1.97712e-5 |
| e→f | 7374518981.655224 | 0.10094635627054986 | 1.36885e-5 |
| g→h | 39542615855.31887 | 0.5237148844065547 | 1.32443e-5 |

Ship 2 (unshielded, +100% Whipple, `NL_BP2_Noshield.json`):

| Leg | stlDistance (km) | damage | damage/Mkm |
|-----|------------------|--------|------------|
| a→b | 796121281.0291476 | 0.05919164439382611 | 7.43500e-5 |
| c→d | 2364298328.2663155 | 0.04249376215421839 | 1.79731e-5 |
| e→f | 7385767627.964033 | 0.09190944118626754 | 1.24441e-5 |
| g→h | 39515927245.55603 | 0.47578310323878376 | 1.20403e-5 |
| a→h | 38794151179.98675 | 0.5096288237789643 | 1.31367e-5 |

The signal is in the damage-per-Mkm column. On Ship 1 it falls from 8.17857e-5 at the innermost leg to a floor of 1.32443e-5 at the outermost, a factor of 6.2. Treating the outermost leg as the meteoroid-plus-base floor, the excess at a→b is 8.17857e-5 − 1.32443e-5 = 6.854e-5, which is 84% of that leg's total damage-per-Mkm. The excess at c→d is 1.97711e-5 − 1.32443e-5 = 6.527e-6. The ratio of these two excesses is 10.50; the square of the orbital-radius ratio between the two legs (6.12 AU versus 1.98 AU nominal planet radii) is between 9.5 and 10.9 depending on the effective radius assigned to each hop. The excess therefore scales as approximately the inverse square of orbital radius, which is Aem's functional form. By e→f the excess has fallen to 4.44e-7 (about 3% above floor), consistent with the inverse-square law making radiation negligible far out.

Ship 2 reproduces the same shape independently: a→b excess 7.43500e-5 − 1.20403e-5 = 6.231e-5, again roughly 84% of that leg. Ship 2 carries +100% Whipple, which lowered its meteoroid floor relative to Ship 1 (1.20403e-5 versus 1.32443e-5 at g→h) but left the radiation excess essentially unchanged — evidence that the meteoroid channel and the radiation channel are separate and that the radiation coefficient is close to ship-independent.

The a→h control is the confound-breaker. a→h and g→h are the same length (38794 versus 39543 Mkm), yet a→h shows damage/Mkm of 1.31367e-5 against the g→h floor of 1.20403e-5 — an excess of 1.096e-6, or 9.1% above floor — because a→h dives inward to 1.98 AU while g→h stays far out. Same distance, more damage, solely because of proximity to the star. This isolates the radiation component from leg length, which adjacent-planet hops cannot do.

Converting the empirical excess to a coefficient in Aem's units: extrapolating Ship 1's a→b excess of 6.854e-5 fraction/Mkm at an effective radius near 2.6 AU back to 1 AU under the inverse-square law gives roughly 4.6e-4 fraction/Mkm, i.e. about 0.046 percent/Mkm for this O-class star. That is within about 1.6× of Aem's KQ-451 blueprint-tab coefficient of 0.0734 percent/Mkm, and it is roughly 17× below Aem's generalised Sunlight-tab constant (which for luminosity 1636 predicts about 0.80 percent/Mkm). In other words, our captures corroborate Aem's KQ-451 tab and contradict his generalised tab — consistent with the ~10× internal discrepancy already present between Aem's two tabs.

The plate result on this same sweep is the sharpest statement of the paradox. Comparing Ship 1 shielded against unshielded leg by leg, damage/Mkm is 8.17875e-5 versus 8.17857e-5 at a→b (the plate leg is 0.0022% *higher*, i.e. noise in the wrong direction), 1.97712e-5 versus 1.97711e-5 at c→d, and identical to six significant figures at e→f and g→h. On the a→b leg specifically — where 84% of the damage is the inverse-square radiation excess — the Specialised Anti-Radiation Plate removed 0.00% of it. Radiation is real on that leg, and the plate marketed to reduce it does nothing measurable.

### 2.7 ANT→SE-110c confirms the plate does nothing on an M-star route

The two ANT→SE-110c captures (`srp_ant_ice_report.txt`) contain no TRANSIT segments; the route is DEPARTURE, JUMP, CHARGE, JUMP, APPROACH, LANDING. The near-star STL leg is the APPROACH into SE-110 at 0.697 AU. SE-110 (Thalassa) is M-class, luminosity 0.00204 — the dimmest class — so even by Aem's generalised formula the radiation over that 78.7 Mkm approach is about 2.05e-6 percent/Mkm, totalling 1.6e-6 in fraction units, roughly 0.13% of the observed approach damage of 1.23e-3. The two captures agree to five significant figures on every leg: APPROACH damage/Mkm was 1.56701e-5 in both, differing by −9e-7 percent; the JUMP and CHARGE damages are byte-identical; the only material difference is the LANDING leg, which differs by 8% purely because the two captures landed over different distances (2786 versus 2397 km), landing damage being distance-driven. The payload contains no component or blueprint fields, so the file itself cannot confirm which capture carried the plate; taken at face value per the request, the plate again shows no effect, on a route where — being M-class — there is essentially no radiation to shield against in the first place.

---

## 3. The plate — every shielded-versus-unshielded result in one place

Collecting every controlled comparison of the Specialised Anti-Radiation Plate against no plate: the 2026-07-06 APPROACH matched pairs at VH-192, UB-557, LS-231 and EY-430 all returned radiation at or below 0.00015% with two values negative (`radiation_data_table.txt`, `radiation_matched_v3.txt`); the TRANSIT residual test returned no-shield-minus-shield residual differences of −7.16e-7 (WX-827a), −1.35e-7 (GH-459c) and +1.99e-7 (VH-331a) (`transit_residual_shield_test.txt`); the NL-534a O-class approach showed identical damage-per-metre of 1.4020e-10 in both states (`nl534_result.txt`); the full NL-534 sweep showed identical damage/Mkm in both states on all four legs including the a→b leg that is 84% radiation (`NL_NOSIELD.json` versus `NL_WITHSHIELD.json`); and the ANT→SE-110c pair agreed to five significant figures on every leg (`srp_ant_ice_report.txt`).

The only apparent plate effect anywhere in the entire dataset is in the 2026-07-06 APPROACH campaign at CG-021, XG-452 and AM-528, where dividing the no-shield-minus-shield difference by 0.70 produced the values in section 2.1 (for example XG-452a radiation 1.37%). Those are the sole positive results, they come from the earliest and least-controlled captures, they are the same captures whose luminosity scaling fails cross-system by 2500×, and the fuel/mass offset from the plate's 15 t means the shielded and unshielded runs there never shared an identical slider — the concern raised in `PrUn_Handover_2026-07-07.md`. Every later, better-controlled test, including the O-class NL-534a approach and the NL-534 sweep, returns zero plate effect. The weight of evidence is that the plate does not reduce observed flight damage, and that the early positive APPROACH deltas were slider/route/mass artefacts rather than shielding.

The paradox to be explicit about: the NL-534 sweep shows radiation damage is real and large on close-in legs, and the same sweep shows the anti-radiation plate does not reduce it. Both statements rest on the same clean dataset. Either the plate mechanic is inactive or bugged in the current game, or the plate acts on a quantity that is not what these captures measure. This is the single most important unresolved item.

---

## 4. Prior community work

### 4.1 Aem's spreadsheet (`Aem - Damage plotting.xlsx`)

Aem's derivation, reconstructed in `RADIATION_STATE.md` and `project_aem_radiation_formula` (memory), rests on two tabs. The KQ-451 tab holds blueprint test flights around the O-class star KQ-451 (luminosity 1591), flown through radial distance bands from roughly 2–4 AU out to 290–490 AU, with and without advanced anti-radiation shielding, from which Aem subtracts a constant meteoroid floor of 0.0002 percent/Mkm and fits the remainder to an inverse square in distance. That tab yields radiation = 0.0734·AU⁻² percent/Mkm unshielded and 0.0224·AU⁻² shielded; the ratio 0.0224/0.0734 = 0.305 is the origin of the "70% reduction" figure the whole investigation divided by. The Radiation-damage tab generalises across star classes through a single coefficient, column AH = Sunlight × 3.56484936e-7, equivalent to radiation percent/Mkm = 4.875e-4 × luminosity × AU⁻² once one uses the identity Sunlight × AU² / luminosity = 1367.53, which holds to that constant across all star classes in the data.

Two issues must be stated fairly. First, the two tabs disagree on the absolute constant by about 10.6×: the generalised tab implies 0.776 percent/Mkm at 1 AU for KQ-451's luminosity, while the KQ-451 tab's own fit gives 0.0734. Our NL-534 captures side with the KQ-451 tab to within about 1.6× and against the generalised tab by about 17×. Second, and this is the point most relevant to the plate, Aem's shielded column on the KQ-451 tab is a computed column, not flown data — the shielded value is the unshielded value multiplied by 0.305 in the cell formula (`S48 = 0.305*0.0734`). So Aem's spreadsheet does not contain an independent measurement of the plate reducing damage; the 70% figure is an input to his shielded column, not an output measured from it. Aem's inverse-square *shape* is corroborated by our data; his absolute constant is uncertain by an order of magnitude; and his shielded numbers were never separately measured. None of this is a criticism of Aem's care — the KQ-451 flights are real and the form is right — but the plate's effectiveness cannot be inferred from his sheet.

### 4.2 RNGzero's spreadsheet (`PrUn Ship Repair Calc.xlsx`, shared by Raylu)

RNGzero's calculator, reviewed in `srp_ant_ice_report.txt`, contains sheets `Ship Calc`, `Min/Half/Max Preset Trips data`, `Hull Reducer` and `RO - CALC Sheet`. Its mechanism is a decomposition model: each preset trip's total damage is split into Wear, Meteor, Heat and Radiation channels, and the `Hull Reducer` sheet hard-codes each plate's multiplier, with the Specialised plate entered as 0.7 (removing 70% of the Radiation channel). For the Ant→Ice-Station preset the sheet assigns a large radiation channel — the Radiation column reads 0.377 in the Min-preset, 0.35 in the Half, and 0.374 in the Max — corresponding to a normalised radiation share of roughly 0.18–0.19 of the trip. A note on the sheet (row 29 of the preset tabs) states the preset trips "were calculated in BLU using a HCB ship with minimal fuel use & under a full inventory load," meaning these channel splits are modelled estimates, not measured shield-on versus shield-off deltas.

The precise and fair reading is this. RNGzero's calculator does not measure radiation; it assumes a radiation channel as a fixed fraction of trip damage and then credits the Specialised plate with removing 70% of that assumed channel. On the Ant→Ice-Station route specifically, SE-110 is M-class with luminosity 0.00204, the dimmest class, so a radiation channel of 18–19% of the trip is physically implausible there, and our two captures on that exact route show the near-star approach damage is unchanged with versus without the plate. The calculator's recommendation to fit the plate on that route therefore follows from the assumed decomposition rather than from measurement, and the assumption does not survive contact with either the star's luminosity or the captures.

---

## 5. What remains open, and the experiment that would close it

Four things are unresolved.

The plate paradox is first and most important. Radiation damage is real and inverse-square, and the Specialised Anti-Radiation Plate reduces it by zero in every controlled capture we have, including the leg where radiation is 84% of the damage. We cannot presently say whether the plate is simply inert in the current game, whether it was changed since Aem's KQ-451 flights, or whether it acts on some quantity these captures do not expose. Every conclusion about the plate's worthlessness is empirically supported; the *reason* is not known.

The absolute radiation constant is second. The inverse-square shape is solid, but the coefficient is pinned only by a single O-class system (NL-534) on two ships, giving roughly 0.046 percent/Mkm at 1 AU, which agrees with Aem's KQ-451 tab to about 1.6× and disagrees with his generalised tab by about 17×. On top of that physical uncertainty sits a bookkeeping one: the 1000× `stlDistance` unit convention (kilometres, distMkm = /1e6) must be applied consistently, and two intermediate scripts in this folder did not. The constant should not be hard-coded into any tool until it is confirmed.

Cross-system luminosity scaling is third, and it is a genuine warning. The 2026-07-06 APPROACH fit found two nearly identical B-class stars — CG-021 (luminosity 142.9) and LS-231 (luminosity 157.1) — giving radiation differing by about 2500× at the same orbital radius (`radiation_formula_fit.txt`). If that result is real and not an artefact of the uncontrolled early captures, then luminosity alone does not drive the coefficient and some per-star or per-system property is missing from the model. This must be reconciled before any luminosity-based generalisation is trusted, and it is precisely the kind of question your ephemeris and systems work may already bear on.

The meteoroid contamination question is fourth and smaller. The meteoroid formula under-predicts WX-827a transit systematically by 8.9%, and it was itself fitted to real flights; if any of those calibration flights passed close to a hot star, a little radiation may already be absorbed into the meteoroid coefficient, which would slightly distort the split between the two channels near stars. This is a second-order effect but worth checking against the list of systems used to fit 7.1692e-6.

The experiment that closes the first three at once is small and well-defined. Fly Specialised-plate-on versus plate-off, at matched slider, at two or three known radial distances around a *second* hot star — ideally a B-class such as NH-555 (luminosity 149) and one more O-class such as XG-452 or AM-528 — capturing intra-system TRANSIT legs long enough to clear the determinism floor (`candidate_flight_predictions.txt` shows even a 1 Mkm leg clears it comfortably). Two hot stars of different luminosity at known radii would pin the absolute constant, test whether it scales with luminosity or fails as the CG-021/LS-231 pair suggests, and give the plate its cleanest possible test at the orbital radius where radiation dominates. Game damage is deterministic to about 5e-9, so the measurement is not noise-limited; it is limited only by capturing the right legs. Nobody has yet flown that specific matched-slider, plate-on/plate-off sweep at a second hot star, and it is the single highest-value capture remaining.

---

## Appendix — files and their contents

The raw captures are `NL_NOSIELD.json` / `NL_WITHSHIELD.json` (Ship 1 sweep, both plate states), `NL_BP2_Noshield.json` (Ship 2 sweep with a→h control), `ant_ice.json` (ANT→SE-110c plate pair), the four `prun_rad_dam_*` and WX-827/GH-459 `.jsonl` files (the 2026-07-06/07 APPROACH and TRANSIT captures), and the `OldCaptures\` subfolder (the original 2026-07-06 blueprint-tester sessions). The derived analyses are `radiation_data_table.txt`, `radiation_formula_fit.txt`, `rad_regression_v2.txt`, `radiation_matched_v3.txt` (APPROACH campaign); `radiation_correlation.txt` and `notes.txt` (channel correlation); `workstream_c_result.txt` and `transit_residual_shield_test.txt` (meteoroid verification); `aem_model_vs_captures.txt` and `wx_gh_formula_rerun.txt` (Aem model versus captures); `nl534_result.txt` (O-class approach plate test); `candidate_systems.txt` and `candidate_flight_predictions.txt` (target selection); and `srp_ant_ice_report.txt` (ANT→SE-110c). Star and planet references are `star_list_OB.txt`, `system_classes.txt` and `planet_params.txt`, drawn from `all_stars.json`, `all_planets.json` and the flight-planner's `systemstars.json` (galaxy star/system data — per-system luminosity and meteoroid density — sourced from FIO and submitted by SAGANAKI; credit to them for gathering it). The multi-megabyte raw inputs (`all_planets.json`, `all_stars.json`, the large `.jsonl` captures) were not re-transcribed here; their relevant contents are distilled into the derived reports named above.

The meteoroid and orbital constants used throughout: meteoroid `damage = 7.1692e-6 × (stlDistance/1e6) × density^(0.683 + 0.223·log10(density))`; AU = SemiMajorAxis (metres) / 1.496e11; and for `stlDistance` in kilometres, AU of a transit endpoint ≈ stlDistance / 1.496e8. Only nine O/B systems exist galaxy-wide (four O, five B), and all have MeteoroidDensity between 2.0 and 4.7, so no low-meteoroid hot-star system exists to make radiation trivially visible — which is why the shield-difference and orbital-radius-sweep methods, rather than density filtering, were necessary.
