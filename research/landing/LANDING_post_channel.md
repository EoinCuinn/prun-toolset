**Landing distance — the last random term in the flight model is now fully characterised**

Been chasing the take-off/landing **landing distance** — the one term that still looked random — and it's not random in the way it looks. Putting the numbers on the table, because most of this rests on prior work here and I want it checked.

**The distance itself (credit Taiyi Bureau):** the *mean* landing distance is Taiyi's planet-term — radius + pressure, the `d ≈ 926 × (R/1e6)^0.96 × (1+P)^-0.42` form, universal constant C=20/3 confirmed across Promitor / Beanironia / Odysseus. That part was already solved. What was left was the ±15% scatter around it.

**The ±15% is a PRNG, not a physics roll (credit Marcus Licinius Crassus):** Marcus's law is `d = k(planet)·(13 + 4·r)`, where `r = new java.util.Random(UUID.hashCode(missionId)).nextDouble()`. So `d ∈ [13k, 17k)` — mean 15k, and the band is exactly `±2/15` = ±13.3% (that's your "±15%"). I ported Java's UUID.hashCode + Random.nextDouble and ran it on our captures: `k = d/(13+4r)` is constant per planet to **0.0000% CV over 18 planets**, and a parameter-free ratio check matches to **0.0000% over 27 pairs**. Marcus already had this at **R²=1.000000 across 4,482 planets and ~86k flights** — this is just independent confirmation on our own data.

**The seed is client-generated — confirmed on our own captures:** the `missionId` UUID is made by the *client* and sent in the outgoing calc request; the server echoes it back verbatim and derives the landing from it. I joined requests to responses by actionId: **860/860** identical. And real committed flights inherit their plan's missionId and run the same draw — **21 of 25 real landings carry a byte-exact preview distance** (15-sig-fig float match, not chance). So there's no separate real-flight mechanism. (I'm quoting this as "byte-exact twin" rather than a prediction accuracy on purpose — the twin is picked *by* matching distance, so any "0.00000% error" there is circular; the real content is that the exact twin exists.)

**But you can't steer it — the bundle settles that:** obvious next question is "if I pick the missionId, do I pick the landing?" I disassembled the game bundle. The UUID generator is textbook v4 fed by `crypto.getRandomValues()` — OS CSPRNG. The `uuid` module has an rng-override seam but it's never used; `Math.random` has 60 hits in the bundle, 0 in the uuid module. So the missionId is true entropy — **unsteerable at source.** The honest model is read-it-don't-seed-it: you can *predict* a landing off the wire once the client sends the missionId, but you can't make it roll low. (Yes, the 860/860 echo means a forged missionId would be honoured — but that's active frame injection, not normal play. Documenting the mechanic, not a how-to.)

**Fixed-tile hypothesis — refuted:** the open question was whether real flights *to an owned base* land on a fixed tile instead of re-rolling. They don't. I have six cases of the same ship landing at the same base (planets I hold bases on, one base per planet, so same ship + same planet = same base), and every one landed at a different distance — spreads from 1.6% to 18.0%:

- VH-331g, ship `58d4a05…`: 4336.3 → 5118.3 km
- VH-331g, ship `2e4405…`: 4368.9 → 4826.4 km
- OF-443b, ship `58d4a05…`: 8279.2 → 8970.5 km
- VH-331a, ship `58d4a05…`: 4426.5 → 4750.4 km

VH-331g alone was flown 7 times → 7 different distances. A fixed base tile would be ship-independent and give the same distance every arrival; these re-roll, and since landing distance is deterministic to ~machine precision, even the 58 km gaps are real different draws. So real flights to an established base draw the same ±13.3% PRNG as previews — **no fixed tile.**

Full writeup with every number attached. Grateful for Marcus's law and Taiyi's distance work — this was mostly bolting the RNG onto the model you'd both already built.
