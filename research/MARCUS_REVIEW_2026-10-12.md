# Marcus Licinius Crassus — planner review, 2026-10-12

Received via Discord after the public launch. Full correction pass on
`public/prun_flight_planner.html` plus the ship builder and ephemeris
fallback. Verbatim source at the bottom.

Spot-checked against the code on receipt: the G-cap no-op comment (L1324),
the 0.000353·pc jump-damage constant (L986, exactly 35.3× his 1e-5·pc), the
926·R^0.96·(1+P)^−0.42 landing form (L916) and the charge-damage snapshot
constants (L991) are all present exactly as described.

---

## Triage

### A. Drop-in corrections — closed form replaces a fitted proxy
Low risk, high confidence, no new data needed.

| # | Item | Now | Should be |
|---|---|---|---|
| A1 | Jump damage | `0.000353·pc` | `h·1e-5·pc` — **35× too high** |
| A2 | TO/LND fuel constant | `337.3` | `336.9 = (4/0.06)·√(350.11/13.71)` |
| A3 | Take-off distance | fitted 0.1482/0.4521/0.30 | `R(km)·(0.15 + 0.45·P^log10(2))`, no floor — exact on 86,564 legs |
| A4 | Landing mean | `926·R^0.96·(1+P)^−0.42` (6% median fit) | `pf·R(km)`, `pf = 0.15 + 0.45·max(P,0.1)^(−log10 2)` — use for landing **time** too |
| A5 | Landing roll | — | `d = (pf·R/15)·(13 + 4r)`, r from missionId PRNG (±13%) |
| A6 | SSC count | — | `⌈V/21⌉` |
| A7 | Hull plates | `⌈V^(2/3)/2.07⌉` (misses 6/160) | `⌈(36π)^(1/3)·V^(2/3)/10⌉` — exact. One plate per 10 m² of equivalent sphere |
| A8 | CQT band | ends 999 | ends ~900 (CQS already fitted at V 962–981) |

### B. Structural — law is wrong, not just the constant

**B1 — G-cap on real fleet (~8% error on every clamped ship).**
`maxGFactor: null` at L1324 means real-fleet accel is raw `thrust/mass`.
Must clamp to `9.81·(plate base + seat bonus)`: LHP 10, BHP 8, RHP 11,
HHP 13, AHP 15; BGS +5, AGS +12. Every 034-class BHP freighter is clamped
(92.13 → 78.48 = 8·9.81). STL times ~8% short, TO/LND fuel ~8% low.
FIO's `Acceleration` field should already include the clamp — check that
first, it may be a one-line fix.

**B2 — STL leg timing ignores the fuel slider.**
Every leg is timed at the saturated triangular tier `M = √(d/4a)`. The game
allocates fuel first, then times with `t = d/(2aM) + 2M` when `d > 4aM²`.
Correct allocation:
```
wells first; rem = committed − wells
c   = 4 + 2·hasLND − 2·hasTO
dep = min(⌊(rem − c)/2⌋, ⌈(flow/0.03)·√(d/a)⌉)
app = rem − dep
```
H1 anchor (034RE, Hortus→Boucher, 344 SF committed): planner gives DEP 1,017 s
/ APP 1,537 s vs game 1,180 / 2,256 — **14% and 32% short**. Total looks fine
only because jumps dominate. The correct split gives H1 DEP 145 / APP 151
exactly.

⚠ The `13.34·fuf·stlFuel/a` departure cap and `0.491·tank·fuf` approach fuel
both came from CALCULATE_TEST_FLIGHT previews. **Previews don't share
real-flight budget semantics — recalibrate on real flights only.**

**B3 — Well-leg duration and fuel.**
Atmospheric accel is `a/350.11`.
`M = ⌈√(d/(13.71·a/350.11))⌉`, `t = d/(2·(a/350.11)·M) + 2M`,
`fuel = M` at flow 0.015 (scale by `flow/0.015`).

**B4 — Ephemeris fallback runs the wrong way round.**
True motion is `M = −n·worldtime + π/2`, **clockwise**. The fallback
propagates prograde with `M0 = 0`, so the rendezvous solver has the planet
moving backwards for every planet outside the fitted ephemeris.

**B5 — In-system reduction.**
Works in the `z = 0` projection. Projecting O and P before
`calculateSltDistance3D` takes median error 0.155% → 0.033%. The fallback
`1 − R/E(ψ,m)` divides by E, which → 0 as ψ → 0. Marcus suggests the
tabulated reduction surface over the formula.

### C. FTL — mostly unimplemented, now fully specified

| # | Item | Law |
|---|---|---|
| C1 | Charge fuel | `⌊P·ρ·pc/333⌋` FF, pc = parsecs of the jump it precedes. First charge booked on DEPARTURE. 62,488 pairs, zero mismatches. Scales with **reactor** power, not emitter |
| C2 | Reactor β | `4.4e-4·P` is −6%/+5% off. Measured: RCT 1.123, QCR 0.929, HPR 2.002, HYR 2.976 |
| C3 | A | **Not a reactor property.** At ρ=1, `1/ftlMaxSpeed` is exactly linear in hull volume within each (reactor, emitter set) class; independent of mass |
| C4 | Real-ship anchor | `J(1) = 3600 / vmax(pc/h)` from the blueprint FTL speed. The 034 (JHPO, A 2451, β 0.723) is otherwise **18% fast** |
| C5 | Slider floor | min usage `E/P`, `E = 100·SFE + 175·MFE + 300·LFE` |
| C6 | Charge time | `(3/8)·E/f`. Counts **jumps − 1**; charge fuel and charge damage count **every** jump (the first sits inside DEPARTURE) |

### D. Damage — complete model
All values are fractions of condition, times hull factor `h = 1 − SHIELDING_GENERAL`
(this is the ×1.1 the LHP blueprints show).

| Segment | Law |
|---|---|
| Jump | `h·1e-5·pc` (no ρ or reactor dependence) |
| Charge | `h·5e-4·(ρ − E/P)`. RCT 7.133e-5 = this at ρ≈0.42, E=675; QCR 6.875e-6 = ρ≈0.50, E=975 |
| Take-off | `h·T·G(g)` where `G = 1.5e-5 + 6e-5·(0.25 − g)` for g<0.25; `1.5e-5 + 6e-6·(g − 2.5)` for g>2.5; else 0. Same thresholds as building materials. 181 planets nonzero |
| Landing | `h·T·[G(g) + min(4e-7·P, 1e-5)]` |
| DEP / APP / TRANSIT | `h·d(km)·[2e-12 + 5e-12·MeteoroidDensity + 2e-22·√(F1·F2)]`, F = solar flux `Luminosity·3.0605e25/r(km)²` at the 3-D start and end points. Independent of speed and M |
| Gateway | unknown |

Notes:
- **M2 landing fit has the wrong accel exponent.** T goes as √(d/a), so −0.5,
  not −0.94. Pressure exponent is exactly 1.
- **MG-197e is not an outlier** — the pressure term hard-caps at P = 25.
- The meteor density power law with ρ-dependent exponent is approximating
  `2e-12 + 5e-12·ρ`. "Star type absent" is correct *for that term*, but the
  star re-enters through **flux** — that is where the 7% worst residual lives.
- Across 89,189 segments: median 5e-6, p99 0.2%.

### E. Routing — affects what we tell Raylu

**Min-hop is exact.** The server routes by fewest jumps, so the planner's
uniform-weight Dijkstra is *correct*. Distance weighting would diverge from
the game — do **not** add it.

The only open part is the equal-hop tie-break: greedy farthest-from-destination
among min-hop neighbours matches the server 84%. The remainder is server-side
non-determinism, so BFS first-found is the floor.

### F. Ship builder — fractional component volumes
The integer volume deltas can't all be right. Every QCR/HPR + MFL combination
comes out 1 m³ high because true component volumes are fractional:
QCR 6–7, HPR 116–117, MFL 5–6, MSL 125.8–126.2.
With A6 + A7 + A8 and these, **the empty-mass chain is perfect on 160/160**.

---

## Where each item can be worked

- **Laptop (now):** A1–A8, B1–B5, C1–C6, D, E — all code changes plus
  validation against the 237 MB of local captures.
- **Desktop only:** F. Needs `C:\prun-tools\prun-openmass\blueprint_data.jsonl`
  and `blueprints_master.json`, which do not exist on the laptop.

---

## Suggested order

1. **A1** (jump damage 35×) — one constant, largest single error in the file
2. **B1** (G-cap) — ~8% on every clamped real-fleet ship; check FIO's
   `Acceleration` field first, may be nearly free
3. **A2–A5** — boundary-leg closed forms, replaces three fitted proxies
4. **B4** (ephemeris direction) — a sign error producing wrong rendezvous
   for every unfitted planet
5. **D** — damage model as a block, since the terms interact through `h`
6. **B2/B3** — leg timing, the biggest restructure; needs real-flight
   recalibration, not previews
7. **C** — FTL, largely new work (Phase 6)
8. **F** — desktop

---

## Also

Marcus closed with *"I should uh… Uhhh… Probably make a readme or something lol."*
This dump is a paper's worth of material and currently exists only in a
Discord message. Worth offering to host it in `research/` with his name on it
— he has already done the work, and the repo is public and MIT.

---

## Verbatim source

> This is so sick, dude. Genuinely.
>
> The structure is right (/12 parsecs, A·e^(−βρ) jumps, (3/8)·P/f charges, 3 pc/h gateways, the 0.5 AU gate, the fitted ephemeris, the landing PRN). The only things I see are in the constants, and in a few places where a fitted proxy stands in for a law that has a closed form, model and math only.
>
> On STL leg timing, every leg is timed at the saturated triangular tier M = √(d/4a) regardless of the fuel slider. The game allocates fuel first and times the leg with t = d/(2aM) + 2M whenever d > 4aM². On the H1 anchor (034RE, Hortus to Boucher, 344 SF committed) the planner gives DEP 1,017 s and APP 1,537 s against the game's 1,180 and 2,256, so 14% and 32% short. The total only looks fine because jumps dominate. Should be well legs first, rem = committed − wells, dep = min(⌊(rem − c)/2⌋, ⌈(flow/0.03)·√(d/a)⌉) with c = 4 + 2·hasLND − 2·hasTO, app = rem − dep. That gives H1's DEP 145 and APP 151 perfectly. The 13.34·fuf·stlFuel/a departure cap and the 0.491·tank·fuf approach fuel both came from CALCULATE_TEST_FLIGHT previews with arbitrary fuel loads, and previews don't share real-flight budget semantics. Id calibrate the split on real flights only.
>
> On the G-cap, real-fleet acceleration is thrust/mass with no clamp. It has to be clamped to 9.81·(plate base + seat bonus): LHP 10, BHP 8, RHP 11, HHP 13, AHP 15, with BGS adding 5 and AGS adding 12. Every 034-class BHP freighter is clamped (92.13 → 78.48 = 8·9.81), so STL times run about 8% short and TO/LND fuel about 8% low. FIO's Acceleration field should already include the clamp.
>
> On the boundary legs, Take-off distance d = R(km)·(0.15 + 0.45·P^log10(2)), no floor, exact on 86,564 legs, the 0.1482/0.4521/0.30 constants are rounded versions of this. Landing mean is pf·R(km) with pf = 0.15 + 0.45·max(P,0.1)^(−log10 2). The per-flight roll is d = (pf·R/15)·(13 + 4r), r = java.util.Random(UUID.hashCode(missionId)).nextDouble(), so ±13% around the mean. Use pf·R for landing time too, the 926·R^0.96·(1+P)^−0.42 form still used at atmLeg is a 6%-median fit of the same quantity. Duration and fuel for either well leg, atmospheric accel is a/350.11, M = ⌈√(d/(13.71·a/350.11))⌉, t = d/(2·(a/350.11)·M) + 2M, and fuel = M at flow 0.015 (scale by flow/0.015 for other engines). The 337.3 constant should be 336.9 = (4/0.06)·√(350.11/13.71).
>
> FTL fuel should be super easy too. Each charge burns ⌊P·ρ·pc/333⌋ FF where pc is the parsecs of the jump it precedes, and the first charge is booked on the DEPARTURE segment. 62,488 charge/jump pairs, two reactor powers, ρ from 0.3 to 1.0, zero mismatches. It scales with reactor power, not emitter power. For then reactor constants, β = 4.4e-4·P is off by −6% to +5% per reactor; measured 1.123 / 0.929 / 2.002 / 2.976 for RCT / QCR / HPR / HYR. A is not a reactor property. At ρ = 1, 1/ftlMaxSpeed is exactly linear in hull volume within each (reactor, emitter set) class and does not depend on mass. For a real ship anchor J(1) = 3600 / vmax(pc/h) from the blueprint's FTL speed, the 034 (JHPO, A 2451, β 0.723) is otherwise 18% fast in the planner. For the slider, the minimum usage is E/P with E = 100·SFE + 175·MFE + 300·LFE, and emitterChargeTime = (3/8)·E/f. Charge time counts jumps − 1, charge fuel and charge damage count every jump (the first one sits inside the departure).
>
> For damage the fitted constants in the planner are snapshots of these at one ρ or one planet set. All values are fractions of condition, times a hull factor h = 1 − SHIELDING_GENERAL, which is the ×1.1 your LHP blueprints show. Jump damage is h·1e-5·pc, radDmgRaw = 0.000353·pc is 35× too high, and it does not depend on ρ or reactor. Charge damage is h·5e-4·(ρ − E/P), the RCT constant 7.133e-5 is this law at ρ ≈ 0.42 for a 675 GW emitter set, and the QCR 6.875e-6 is ρ ≈ 0.50 with E = 975. Take-off damage is h·T·G(g) with G = 1.5e-5 + 6e-5·(0.25 − g) below g 0.25, 1.5e-5 + 6e-6·(g − 2.5) above 2.5, else 0, the same thresholds as the building materials, 181 planets are nonzero. Landing damage is h·T·[G(g) + min(4e-7·P, 1e-5)]; the M2 fit has the wrong accel exponent (T goes as √(d/a), so −0.5, not −0.94), the pressure exponent is exactly 1, and MG-197e is not an outlier because the pressure term hard-caps at P = 25. Departure, approach and transit damage is h·d(km)·[2e-12 + 5e-12·MeteoroidDensity + 2e-22·√(F1·F2)], where F is the solar flux Luminosity·3.0605e25/r(km)² at the 3-D start and end points, independent of speed and M. The meteor fit's density power law with a ρ-dependent exponent is approximating 2e-12 + 5e-12·ρ, and "star type absent" is right for that term, but the star still enters through flux, which is where the 7% worst residual lives. Across 89,189 segments, median 5e-6, p99 0.2%. No idea about gateway damage lol.
>
> Also for the Ephemeris fallback, the planets outside the fitted ephemeris the motion is M = −n·worldtime + π/2, clockwise. The fallback propagates prograde with M0 = 0, so the rendezvous solver calculates a planet moving the wrong direction.
>
> The In-system reduction works in the z = 0 projection, projecting O and P before calculateSltDistance3D takes the unreduced median from 0.155% to 0.033%. The fallback 1 − R/E(ψ,m) divides by E, which goes to 0 as ψ goes to 0. Honestly I would probably use the tabulated reduction surface instead of the formula for accuracy.
>
> Sort of tangential but Min-hop is exact. For the equal-hop tie-break, greedy farthest-from-destination among min-hop neighbours matches the server 84%. The rest is server-side non-determinism, so BFS first-found is the floor. Hopefully I'm wrong about that but I doubt it.
>
> Last thing I swear, on the ship builder, Crew quarters, CQS is already fitted at V 962 to 981, so the CQT band ends near 900, not 999. Plates: ⌈(36π)^(1/3)·V^(2/3)/10⌉ (one plate per 10 m² of the equivalent sphere) is exact, while ⌈V^(2/3)/2.07⌉ misses 6 of 160. SSC is ⌈V/21⌉. The integer volume deltas cannot all be right, every QCR/HPR + MFL combination comes out 1 m³ high, because the true component volumes are fractional (QCR 6 to 7, HPR 116 to 117, MFL 5 to 6, MSL 125.8 to 126.2). With those three fixes the empty-mass chain is perfect on all 160/160 configs.
