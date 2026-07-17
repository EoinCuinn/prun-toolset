# Landing research

Reverse-engineering of Prosperous Universe's take-off/landing **landing distance** — the last random-looking term in the flight model.

## What it found

Landing distance is a deterministic pseudo-random draw, not physics:

```
d = k(planet) · (13 + 4·r),   r = new java.util.Random(UUID.hashCode(missionId)).nextDouble()
```

`d ∈ [13k, 17k)` — mean `15k`, band `±2/15` (±13.3%). The mean (`15k`) is the planet radius/pressure term; the band is the PRNG. The seed is the `missionId`, a UUID the **client** generates and the server echoes verbatim. Real flights inherit their plan's `missionId` and run the same draw. The client mints the UUID with `crypto.getRandomValues()` (CSPRNG), so the draw is predictable-from-the-wire but **unsteerable at source**.

Verified on our own capture corpus: per-planet `k` constant to 0.0000% CV (18 planets); parameter-free ratio check 0.0000% (27 pairs); client-echo 860/860; 21 of 25 real landings carry a byte-exact preview distance. Fixed-tile hypothesis **refuted** — six same-ship, same-base repeats each land at a different distance (spreads 1.6–18.0%).

## Files

| File | Audience |
|------|----------|
| `LANDING_SUMMARY_2026-07-16.md` | Full peer write-up (for Marcus Licinius Crassus) — chronology, methodology, every number sourced |
| `LANDING_findings_public_2026-07-16.md` | Repo / community technical write-up |
| `LANDING_post_channel.md` | Discord flight-channel post |

## Data sources

- Flight-planner source: `prun-toolset/public/prun_flight_planner.html` (distance/fuel formulas, constants)
- Verification scripts + capture corpus: `prun-flight-capture/landing-rng/` (80 unique `.jsonl`, 43,149 frames)
- Blueprint dataset (corpus catalogue): `prun-landing/LNG_TEST_TIME_3/blueprint_data.jsonl` (44 blueprints)
- Game bundle disassembly: `bundle.1ac60af678af4c00.js` (CSPRNG confirmation, read-only)

## Credits

**Marcus Licinius Crassus** — landing PRNG law, per-planet-`k` form, R²=1.000000 validation (4,482 planets / ~86k flights), ephemeris/flight-dynamics papers. **Taiyi Bureau** — landing-distance formula, approach-orbit/window-reset observable, C=20/3, galaxy map. **Raylu** (`git.raylu.net/raylu/pruncalc`) — take-off/landing pressure/radius. **SAGANAKI** — FIO galaxy star/system data. Client-side verification + bundle disassembly on own capture data (Eoin Cuinn / EC3, with Claude Code).
