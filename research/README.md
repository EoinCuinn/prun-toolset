# Research

Reverse-engineering of Prosperous Universe flight mechanics from packet captures. Game damage and flight quantities are deterministic to ~machine precision, so these write-ups quote exact numbers, sourced from the capture file named alongside each claim. Each workstream ships the same doc set: a **SUMMARY** (peer write-up), a **findings_public** (community/technical), a **post_channel** (Discord), and a folder **README**.

## [landing/](landing/) — take-off/landing distance

Landing distance is not physics — it is a single deterministic PRNG draw: `d = k(planet)·(13 + 4·r)`, `r = java.util.Random(UUID.hashCode(missionId)).nextDouble()`, so `d ∈ [13k, 17k)` (mean `15k`, band `±2/15` = ±13.3%). The seed is a **client-generated UUID** the server echoes verbatim (860/860); real flights inherit their plan's draw (21 of 25 byte-exact preview twins); the client mints the UUID with `crypto.getRandomValues()` (CSPRNG), so it is predictable-from-the-wire but **unsteerable at source**; and the fixed-tile hypothesis is **refuted** (six same-ship, same-base repeats each land at a different distance).

- [LANDING_SUMMARY_2026-07-16.md](landing/LANDING_SUMMARY_2026-07-16.md) · [findings_public](landing/LANDING_findings_public_2026-07-16.md) · [post_channel](landing/LANDING_post_channel.md)
- Scripts + captures: private repo `prun-flight-capture/landing-rng/` (not included here).

## [radiation/](radiation/) — radiation damage & the anti-rad plate

Radiation-like damage is real on sublight legs near a hot star, rising as ~inverse-square of orbital radius (Aem's functional form), demonstrated on two ships in one O-class system with a flight-length control. Separately, the Specialised Anti-Radiation Plate shows **no measurable effect** in any controlled capture, including the leg where radiation is 84% of the damage — the central open paradox.

- [RADIATION_SUMMARY_2026-07-08.md](radiation/RADIATION_SUMMARY_2026-07-08.md) · [findings_public](radiation/RADIATION_findings_public_2026-07-08.md) · [post_channel](radiation/RADIATION_post_channel.md) · [METEOROID_FORMULA.md](radiation/METEOROID_FORMULA.md)
- Captures, reference data, and analysis scripts are included in-folder (imported from the former `prun-radiation-research` repo).

## [openmass/](openmass/) — ship empty mass & hull volume

`operatingEmptyMass` is exactly the bill of material — `Σ(component weight × count)`, 87 of 87 blueprints, max residual `2.3e-13 t`, no baseline or hull offset. The blocker was `totalVolume`, the hull-envelope figure the game sizes plating and structure from: it is **not** the sum of component volumes (0 of 87) and has no constant packing factor, but it *is* additive over five of the twelve selectable fields and driven by the cargo bay's **m³ capacity** — `totalVolume = 438 + 1.05 × cargo_capM3 + engineΔ + stlTankΔ + reactorΔ + ftlTankΔ` (86 of 87 within 0.5%). With volume known, plate count, structural count, crew quarters and command bridge all follow, and so does exact empty mass. Carries a methodological warning: regression over these fields is confounded and returns confidently wrong coefficients (R²=0.992 while putting the Quick-Charge reactor at −77 m³ where a controlled pair gives +7) — every delta was measured from one-field-change blueprint pairs.

- [OPENMASS_SUMMARY_2026-07-18.md](openmass/OPENMASS_SUMMARY_2026-07-18.md) · [findings_public](openmass/OPENMASS_findings_public_2026-07-18.md) · [post_channel](openmass/OPENMASS_post_channel.md)
- Blueprint corpus, scripts and outputs: `prun-openmass/` (not included here).

## Credits

**Marcus Licinius Crassus** (flight-dynamics/ephemeris papers, landing PRNG law, in-flight mass composition), **Taiyi Bureau** (landing-distance formula, approach-orbit theory), **Raylu** (`git.raylu.net/raylu/pruncalc`), **Aem** (radiation formula), **SAGANAKI** (FIO galaxy data). Capture analysis by EoinCuinn with Claude Code.
