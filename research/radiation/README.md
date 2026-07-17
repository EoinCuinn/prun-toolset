# PrUn Radiation Damage — Research & Data

An investigation into radiation-damage on sublight flight legs in
[Prosperous Universe](https://prosperousuniverse.com/), built on in-game
blueprint-tester captures (deterministic damage, ~5e-9 repeatable), cross-checked
against prior community work. This repo holds the write-ups, the supporting
captures and derived analyses, and the scripts used.

## Headline findings

- **Radiation is real and inverse-square.** On intra-system TRANSIT legs near a
  hot star, damage per unit distance rises as ~AU⁻² (orbital radius) — confirmed on
  two independent ships in the O-class system NL-534, with a same-length control
  leg that rules out a flight-length artefact.
- **The Specialised Anti-Radiation Plate shows no measurable effect** in any
  controlled capture, including the leg where the radiation excess is 84% of the
  damage — even where the plate was independently confirmed fitted. Radiation is
  real; the plate marketed to reduce it does nothing detectable. That contradiction
  is the central open problem.
- **Absolute constant** ≈ 0.046 %/Mkm at 1 AU for the O-class star — within ~1.6×
  of Aem's KQ-451-tab coefficient, ~17× below his generalised tab.

## Start here

| File | What it is |
|---|---|
| `RADIATION_SUMMARY_2026-07-08.md` | The full standalone record — every experiment, number, and file. |
| `RADIATION_findings_public_2026-07-08.md` | The community-channel write-up. |
| `RADIATION_post_channel.md` | The short channel post. |

## What's in here

- **Raw captures** — `NL_*.json` (NL-534 sweeps, plate on/off + a→h control),
  `ant_ice.json`, `prun_rad_dam_*.jsonl`, `prun_rad_WX-827 GH-459 *.jsonl`,
  `nl534a_radiation.jsonl`, and `OldCaptures/` (the original blueprint-tester runs).
- **Derived analyses** — `radiation_*.txt/csv`, `aem_model_vs_captures.txt`,
  `workstream_c_result.txt`, `transit_residual_shield_test.txt`, `nl534_result.txt`,
  `srp_ant_ice_report.txt`, and others.
- **Scripts** — `aem_vs_captures.js`, `wsc_final.js`, `nl534_result.js`.
- **Formula reference** — `METEOROID_FORMULA.md` (the `meteorDmgRaw` meteoroid
  formula the analysis subtracts to isolate radiation).
- **Reference data** — `all_stars.json`, `all_planets.json`, `systemstars.json`,
  `star_list_OB.txt`, `system_classes.txt`, `planet_params.txt`.

## Credits

Built on community work — see [CREDITS.txt](CREDITS.txt). Galaxy star/system data
via FIO, submitted by **SAGANAKI**; radiation formula & KQ-451 dataset from **Aem
(SR)**; repair calculator from **RNGzero** (shared by **Raylu**); flight-dynamics/ephemeris from **Marcus
Licinius Crassus**.

> Aem's damage-plotting workbook is included with permission. RNGzero's PrUn Ship
> Repair Calculator is **not** included — see CREDITS.txt.

## Data note

Capture files contain in-game object identifiers (mission/action/ship/system IDs),
which are client-visible game state. No credentials or personal login data are
present. Prosperous Universe and its data © Simulogics.

## License

The original write-ups, analysis, and scripts in this repository are released under
the MIT License (see [LICENSE](LICENSE)). Bundled game/galaxy data is community
FIO data (© Simulogics) and is included for reproducibility, not relicensed.
