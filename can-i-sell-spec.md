# Spec: "Can I sell X?" — commitment-aware availability

A URL tool that answers one question: **if I sell X of material Y, does anything in my empire go short?**

It has to account for production, stock, open contracts in both directions, and standing corporate commitments — not just what is sitting in a warehouse.

## The rule

```
SUPPLY = network stock (hub + bases + ship holds)
       + INCOMING contract deliveries (you = CUSTOMER, DELIVERY not FULFILLED)
       + production over the horizon, from plans

DEMAND = OUTGOING contract deliveries (you = PROVIDER, not FULFILLED)
       + standing commitments (see config below)

KEEP   = reserve policy for the material (see config)

FREE   = SUPPLY - DEMAND - KEEP
CAN SELL = min(X, FREE)
```

If X > FREE, say so plainly and quantify: the shortfall in units, what it costs in days of cover, and which locations go below their reserve.

The single most important behaviour: **inbound contract deliveries count as supply.** A material with a contract in flight is a prospective resource and should not read as short.

## Config: standing commitments

These are the recurring obligations the tool must know about. Store them in config, not code.

| Counterparty | Material | Rate | Cadence |
|---|---|---|---|
| Syrim | RAT + DW | 3,500 each | weekly, contracts settle Monday |
| Purpleorange | PSL + PSM | 420 each | weekly |
| GuyKid | DCM | 14/day | daily from 22 Nov 2026 |
| Corp | PG | 4,000/day (28,000/wk) | continuous |

Inbound: AL from Syrim at 1,031, covering Berthier's ~514/day usage.

## Reserve policy

Configurable per material, with a default. The Ops Board (someone else's tool, useful as a reference) uses 20 days of production for materials you make with a surplus, and 30 days of usage for materials you buy. Treat that as an example, not a requirement.

## Data sources

All read-only.

**FIO** — `rest.fnar.net`, header `Authorization: <FIO_KEY>`
- `/storage/{user}` — stock everywhere, including ship holds
- `/sites/{user}` — buildings per base
- `/contract/allcontracts/{user}` — **most recent 100 contracts only**; fine for open deliveries, useless for history
- Contract direction: **`Party` is the counterparty's role.** `CUSTOMER` means they buy from you (you deliver, cash in). `PROVIDER` means they supply you.

**PUNoted — usable for the user's own data, not as a corp-wide source.** The user has a legitimate PUNoted API key and the Flight Log already uses it. What is *not* available is corp-level/bulk access: our calls to `/logistics/summary`, `/logistics/sites`, `/logistics/ships`, `/internal/ships/` return 403 and `public/flights` returns 404 (observed 2026-11-20).

So: keep any existing PUNoted usage for the user's own account; do **not** build a corp-wide dependency on it for stock or production, because those calls fail. The user can supply PUNoted context from the dedicated PUNoted session when it is needed.

Stock, contracts and ship holds all come from FIO. Production per day comes from the PrunPlanner plans.

**PrunPlanner** — `api.prunplanner.org`, header `Authorization: Api-Key <PRUNPLANNER_KEY>`
- `/planning/plan/{id}/` — the plan behind each base, which gives production per day and recipe shares

**Optional, dated history** — `api.fnar.net`, header `Authorization: FIOAPIKey <FIOSWAGGER_KEY>`
- `/cx/cxos/historical?username=<lowercase>` — full trade history
- `/ships/flights?username=<lowercase>` — every flight with departure/arrival
- Username must be lowercase; mixed case returns `[]`. Other users return 403.

## Worked example — COF

Current state: HRT holds 1,038 COF against a reserve of 1,400, so the material reads **below reserve by 362**.

An open contract for **600 COF inbound** changes the answer: effective supply 1,638, free **+238**.

- "Can I sell 200 COF?" — yes, 38 left over the reserve.
- "Can I sell 400 COF?" — no, short by 162.

Without counting inbound deliveries the tool gets both answers wrong.

## Requirements

- One input for material, one for quantity, one for where it is going (corp / CX / another player).
- Answer in a single sentence plus the number, not a wall of tables.
- Show the inputs used — stock, incoming, outgoing, reserve — so the answer can be checked by hand.
- Flag any material already below reserve regardless of the query.
- Cache FIO responses for a few minutes; contracts and storage do not need to be live to the second.
