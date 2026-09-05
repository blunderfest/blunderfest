# Historical Evidence PostgreSQL Hydration + Cross-Region Latency — Spike Report

> Date: 2026-09-05 · Brief:
> `docs/historical-evidence-postgre-sql-hydration-cross-region-latency.md`
> Scope: the ~10 s cross-region (`ord → ams`) Historical Evidence PostgreSQL
> hydration penalty left after the Packed Corpus v2 production cutover.
> Measurement first, then the smallest semantics-preserving fix. No PG move,
> no replica, no region/routing change, no packed/candidate/family/DTO
> semantics change, no cross-request cache.

## 1. Executive verdict

```text
BATCHING SOLVES CROSS-REGION LATENCY
```

One Historical Evidence request fetched card game metadata + mainlines with
**two sequential Postgres queries per card** (22 cards → 44 round trips, plus
the menu's `moves_for` = **45 sequential round trips**). Cross-region each
trip costs ~206 ms RTT, so hydration alone took ~9.5–10 s — exactly the
observed ord `pg_ms`. Batching the card hydration into bulk queries issued
once per request (one `games(gids)` + one `moves_for` for the gids the menu
fetch did not already cover) cuts every position to **2–3 round trips**:

```text
start ord:  total 9,600–10,104 ms → median 883 ms (pg 9,465–9,954 → median 753)
```

Both performance targets pass (`start ord pg_ms < 1,000 ms` ✓,
`start ord total < 1,500 ms` ✓), the output is byte-identical (9/9 DTO
parity, prod start DTO SHA-256 unchanged), and the colocated path improved
too. The remaining ord delta is ~3 WAN RTTs — the floor of the current
request shape. No topology work is justified now (Outcome A, §16).

## 2. Production baseline (v2 cutover measurements + fresh pre-change probes)

Carried over from `docs/packed-corpus-v2-production-cutover.md` (2026-09-05,
v516) and **re-measured pre-change on v519** this session (warm, 3 runs each,
rpc on the app machines; stage ms = candidates / menu / evidence / pg):

```text
              ams (PG colocated)                    ord → ams PG
position   total        pg          position   total          pg
start      422–479      287–335     start      9,600–10,104   9,465–9,954
after 1.e4 370–394      274–287     after 1.e4 9,567–10,055   9,462–9,959
Najdorf    710–748      315–352     Najdorf    9,865–9,883    9,455–9,465
A2 (Ruy)   396–397      293–298     A2 (Ruy)   9,561–9,601    9,462–9,487
```

Product CPU (`candidates` + `menu`) is region-independent (42–188 ms in both
regions); the entire ord penalty is `pg_ms` ≈ 9.5 s.

## 3. Current hydration call graph (pre-change, from code + measured)

`Pipeline.analyze` (packed mode — occurrence/book/stats queries are local
packed reads, marked ·local·):

```text
HE request
  +-- Candidates.generate
  |     +-- occurrences(ref_key, 2000)            ·local packed·
  |     +-- position_stats(ref_key)               ·local packed·
  |     +-- pawn_bucket(hash, 2000)               ·local packed·
  |     +-- occurrences(bucket_key, 8) × ≤30      ·local packed·
  |
  +-- moves_for(exact_occurrence gids, ≤2000)     PG  ← 1 query (menu, ADR-0036)
  +-- Families.build (local) + member index (local)
  +-- book(ref_fen)                               ·local book.bin·
  +-- position_stats(ref_key)                     ·local, memoized·
  |
  +-- card 1 (exact)
  |     +-- game(gid)                             PG  ← Q7
  |     +-- moves(gid)                            PG  ← Q5 (gid already in moves_for!)
  +-- card 2 (exact)
  |     +-- game(gid)                             PG
  |     +-- moves(gid)                            PG
  ... × 22 cards (12 exact + 10 structural), strictly sequential
```

Every call is a synchronous `GenServer.call` through the single
`Blunderfest.Corpus` facade, which owns the Postgrex pool — so the 45 PG
round trips are serialized both by the pipeline's per-card loop and by the
facade process. Measured census (`mix corpus.he_pg`, facade trace of one
request per position): exactly `22 game + 22 moves + 1 moves_for = 45` PG
trips on every 22-card position; `21` on the 10-card rare/endgame positions.

## 4. Round-trip accounting

One start-position request (pre-change), measured locally via facade trace:

```text
query type     call count   gids/rows                        caller-observed
moves_for      1            2000 gids → 2000 rows, 1.38 MB   ~30–55 ms (colocated)
game           22           1 gid → 0/1 row each             ~150–200 µs each
moves          22           1 gid → 0/1 row each             ~150–200 µs each
                                                  total pg_ms ≈ 42–92 ms colocated
```

Unique/duplicate gids (Phase E — the cards ≠ 22 unique games):

```text
position   cards   unique gids   duplicate fetches   gids menu already covered
start       22        20               2                    19
after 1.e4  22        22               0                    22
after 1.d4  22        15               7                    15
Najdorf     22        12              10                    11
F1 (KID)    22        22               0                    20
A2 (Ruy)    22        12              10                    12
rare        10        10               0                     0 (no menu)
endgame     10         5               5                     0 (no menu)
```

**Where the ~10 s comes from** — not slow SQL, pure sequential waiting:

```text
45 round trips × 206.6 ms/trip (ord→ams RTT) ≈ 9,297 ms
  + moves_for payload transfer (1.38 MB over WAN)
≈ 9,465–9,981 ms observed ord pg_ms        ✓
```

The 12 exact cards' `moves` queries re-fetch rows the menu's `moves_for`
already returned (12–22 of the 22 per position), and duplicate card gids
(same game, several cards) are fetched again per card — but dedup alone still
leaves 31–45 trips (§8 H1). The round-trip *count* is the problem.

## 5. RTT measurement (Phase C)

Minimal-query probe: `Corpus.game(gid)` — a primary-key lookup, 50 reps,
warm, on the production app machines (`bin/blunderfest rpc`):

```text
path              min       median     p90       max
ams → ams PG      5,065 µs  5,263 µs   5,980 µs  6,860 µs
ord → ams PG      206,231   206,630    208,168   209,873
```

The ord→ams RTT is ~206.6 ms with <2 ms spread; subtracting the colocated
query cost, the WAN adds ~201 ms per round trip. (Local docker colocated:
median 166 µs — the prod colocated 5.3 ms includes the small shared-cpu Fly
Postgres' per-query overhead.) Cross-check: pre-change ord `pg_ms` / 45 =
210–222 ms/trip — consistent with the probe.

SQL execution vs network waiting (the phase's question): colocated ams
pg_ms ≈ 288–397 ms for 45 queries = ~6 ms/query — that is the Fly Postgres
execution + Postgrex overhead on a shared-cpu machine. ord pg_ms ≈ 9,500 ms =
the same ~6 ms/query execution + ~201 ms/trip × 45 network waits. **≥ 97% of
the ord penalty is network waiting, not SQL.**

## 6. Data requirements (Phase D)

What the HE DTO needs from PostgreSQL, exactly (packed mode; everything else
is local/packed):

```text
request-level:
  moves_for(menu gids)       mainlines of the ≤2000 exact-occurrence games —
                             the decision-menu continuation windows
                             (Families.build)            [distinct product concept]
card-level, per card (22×):
  game metadata              white/black/result/date/eco/opening/elos/event/
                             time_control/site (11 columns) → card.game
  mainline                   full SAN list → continuation window (drop_ply+cap),
                             family/skeleton membership, route comparison
```

Not from PG: reference counts (packed v2 headers via the memo), next-move
distribution (book.bin), candidate occurrence lists (packed), candidate
counts (headers). The card set (`exact ++ structural`) and all card gids are
known before any card is assembled — the per-card fetch order carries no
data dependency that would prevent a bulk prefetch.

## 7. Existing repository APIs (Phase F)

```text
Occurrences.moves_for/2     SELECT gid, sans FROM corpus_moves WHERE gid = ANY($1)
                            — already the menu's batch (ADR-0036 hot-key fix);
                            dedupes input; REUSED for card moves
Occurrences.results_for/2   bulk results (book aggregation only) — not suitable
                            (missing the other 10 metadata columns)
Book.counts_for_keys/2      batch occurrence counts (PG occurrence tables; not
                            loaded in prod packed mode)
book.bin                    precomputed next-move aggregate — local
```

Missing piece: **bulk game metadata**. No `games(gids)` existed; the card
hydration's 22 `game/2` calls had no batch equivalent. Added
`Occurrences.games/2` + `Corpus.games/1` — the same `gid = ANY($1)` shape as
`moves_for`, returning `%{gid => game}` with the exact `game/2` row shape.
One abstraction, mirrored on the existing bulk APIs; no second mechanism.

## 8. Hypotheses (Phase G)

| H | Idea | Measurement / reasoning | Verdict |
|---|---|---|---|
| H1 | Deduplicate hydration (fetch each unique gid once) | unique gids 12–22 of 22 → still 25–45 sequential trips; ~9 s stays | insufficient alone — **absorbed** into the batch (uniq before `ANY`) |
| H2 | Batch game metadata `games(gids)` | 22 trips → 1 (−21) | **accepted** |
| H3 | Batch moves `moves_for_games(gids)` | the menu's `moves_for` already covers 11–22 of the card gids; fetch only the rest in one more query — 22 trips → 0–1 | **accepted** (reuse + complement) |
| H4 | Combined hydration in one repository call | a single `games JOIN moves` would repeat 11 metadata columns per move row (~10× payload amplification, §11); **two bulk queries** keep payloads minimal and map 1:1 onto the existing APIs | **accepted as 2 queries**, not 1 statement |
| H5 | Parallelize the existing per-card calls | every corpus call serializes through the single facade GenServer — caller-side fan-out just queues at the facade; parallelizing *inside* the facade is the forbidden redesign, and raises connection demand on the small Fly PG | **rejected** |

## 9. Experiments (Phase I)

Baseline captured before any change (`mix corpus.he_pg` census +
`mix corpus.he_cpu --reps 5`, docker PG colocated; parity snapshot of all 9
DTOs taken on the untouched code). The prototype landed as one atomic,
semantics-preserving change — dedup + games batch + moves reuse/complement
are the same pipeline restructure, so attribution is by the measured call
census and per-stage timings rather than separate deploys:

```text
                        before                          after
PG round trips          45 (22-card) / 21 (10-card)     2–3 everywhere
queries/request         45                              2–3 (1 moves_for menu + 1 games + 0–1 moves_for)
rows/request (cards)    44 (incl. duplicate gids)       10–24 unique (deduped)
payload (card level)    8–27 KB / 44 queries            ≤ before for every position
                                                        (1.5–8.2 KB / 1–2 queries — the same
                                                        rows, never duplicated)
ams pg_ms (start)       54–76 (local) · 287–335 (prod)  37–61 (local) · 54–82 (prod)
ord pg_ms (start)       9,465–9,954                     737–1,240, median 753 (§13)
parity                  —                                 9/9 DTO snapshot, 9/9 backend,
                                                         prod start DTO SHA-256 unchanged
memory                  baseline band                     unchanged (gate peak 135 MB local;
                                                         prod flat ~145 MB across n=1/2/4)
verdict                                                    retained
```

Local pg_ms by position (median, colocated docker): start 58→52, e4 55→45,
d4 62→37, Najdorf 66→53, F1 46→32, A2 68→55, rare 4→1, endgame 4→1. No
position regressed; the menu's `moves_for` (1.0–1.5 MB) remains the local
pg_ms floor, as before.

## 10. Final repository/API design (Phase H)

```elixir
Blunderfest.Corpus.games(gids) :: %{gid => game} | {:error, :not_configured}
```

* input gids may be unordered and contain duplicates — deduped before the
  query (`ANY($1)` on the uniq set); output is a map, addressable by gid;
* gids without a game row are **absent** from the map — exactly what
  `game/1` answers as `nil`; missing move rows stay absent from
  `moves_for`'s map — what `moves/1` answers as `[]`;
* database errors **raise** from `Postgrex.query!` — as the individual
  lookups always did (one missing row does not crash a request; a DB failure
  crashes it, same as before);
* no cache, no cross-request state — the maps are built per request in
  `Pipeline.hydrate_cards/2` and die with the request;
* deterministic: map lookups by gid; input order cannot change any card.

Pipeline shape (the menu's `moves_for` stays its own request-level concept —
Phase L: it feeds `Families.build`, not the cards; its *result* is reused):

```text
candidates → moves_for(menu gids) → Families.build →
hydrate once: games(unique card gids) + moves_for(card gids − menu gids) →
cards assembled from the maps (pure)
```

The evidence stage is now pure local CPU; `pg_ms` = menu fetch + hydration
fetch (same field, cleaner composition — it no longer overlaps
`evidence_ms`).

## 11. SQL / query plans (Phases J/K)

```sql
SELECT gid, white, black, result, date, eco, opening,
       white_elo, black_elo, event, time_control, site
FROM corpus_games WHERE gid = ANY($1)                    -- parameterized, $1 = uniq gids
```

`EXPLAIN ANALYZE` (local PG, 22 random gids): **Index Scan using
corpus_games_pkey**, 22 index searches, 22 rows — the identical access path
the per-card queries used, once per request instead of 22×. Same for the
pre-existing `moves_for` at 2000 gids (PK index scan, 1 row per gid). No new
indexes needed — the evidence pointed to round trips, not slow SQL, and the
plans confirm it.

Payload (Phase K, `:erlang.external_size`): the two-query shape transfers
**no more** than the per-card shape, and less wherever card gids duplicate
(dedup removes 2–10 fetches per position; start 27.1 KB → ~6.7 KB card-level,
endgame 16.9 KB → ~8.2 KB). The join alternative was
rejected up front: game metadata × every move row would amplify the
card-level payload ~10× for zero round-trip benefit over 2 queries. The
dominant payload stays the menu's `moves_for` (1.0–1.5 MB) — unchanged,
already one query.

## 12. Correctness (Phase M)

```text
9/9 identical, 0 unexplained differences — at every step:
  mix corpus.he_cpu --compare  vs the pre-change snapshot:
    start · 1.e4 · 1.d4 · Najdorf · F1 · A2 · rare · endgame · same-game dup
  mix corpus.he_parity (broadcast v1 ↔ v2, batched pipeline): 9/9 identical
```

Explicitly verified: card ordering (`exact ++ structural`, unchanged), game
metadata (bulk map ≡ `game/2` per gid — unit parity test), exact move
ordering (`moves_for` ≡ `moves/2` per gid — unit parity test), route/context
(snapshot carries every card's route), occurrence support + independent-game
counts (packed headers, untouched), `same_game_only` (snapshot + the
same-game fixture), family/menu output (snapshot `reference.families` +
`next_moves`). DTO shape unchanged — `timings` kept its exact fields.

Production: the start-position DTO captured on both regions after the deploy
is **SHA-256-identical to the pre-deploy production DTO** and to the local
snapshot (`83f6b037…`).

## 13. Performance (Phases O/P — before/after, all permanent positions)

Local (docker PG colocated, warm medians, `mix corpus.he_cpu --reps 5`):

```text
position      before total / pg      after total / pg
start         200 / 58               212 / 52
after 1.e4    132 / 55               125 / 45
after 1.d4    143 / 62               161 / 37
Najdorf       385 / 66               465 / 53
F1 (KID)      216 / 46               230 / 32
A2 (Ruy)      129 / 68               145 / 55
rare           72 / 4                 67 / 1
endgame        10 / 4                  7 / 1
```

(Totals within session noise — the he_bench report's known menu/bucket-cache
variance; pg improved everywhere. Phase 3 gate re-run: **PASS**, median
182 ms, peak 135 MB.)

Production, warm medians (rpc probes, 3 runs/position + 10 runs start):

```text
              ams before → after              ord before → after
position   total        pg                total           pg
start      422–479 → 213   287–335 → 63   9,600–10,104 → 883   9,465–9,954 → 753
after 1.e4 370–394 → ~175  274–287 → ~57  9,567–10,055 → 677   9,462–9,959 → 550
Najdorf    710–748 → 479   315–352 → 63   9,865–9,883 → 1,192  9,455–9,465 → 759
A2 (Ruy)   396–397 → 192   293–298 → 69   9,561–9,601 → 684    9,462–9,487 → 561
```

Start-position ord, 10 consecutive warm runs (post-change):

```text
total ms: 871, 878, 879, 880, 880, 883, 903, 907, 919, 1,376  → median 883
pg ms:    737, 742, 743, 745, 749, 753, 759, 763, 776, 1,240  → median 753
```

The ~1.24 s outlier mode (2 of 13 warm runs) sits ~+480 ms ≈ WAN transfer
jitter on the 1.38 MB menu payload at low effective throughput; the steady
mode is 737–776 ms pg. Targets: `start ord pg_ms < 1,000 ms` **PASS**
(753), `start ord total < 1,500 ms` **PASS** (883; max observed 1,376).

## 14. Concurrency / DB load (Phase Q)

```text
                        before          after
queries/request         21–45           2–3          (−86…96%)
connections/request     ≤1 concurrent   ≤1 concurrent (unchanged — the facade
                                        serializes; batch queries check out one
                                        connection each, sequentially)
rows/request (cards)    44              21–32 (deduped)
query execution time    unchanged SQL access path (PK index scans), fewer of them
```

Concurrency probes (start position):

```text
local  n=1/2/4: wall 139 / 198 / 297 ms · peak ≤ 155 MB   (flat)
prod ord n=1/2/4: wall 924 / 1,613 / 3,222 ms · BEAM total flat ~145 MB
       (wall grows ~linearly — the documented single-GenServer serialization,
        unchanged by design; no errors, no pool pressure, no OOM)
```

## 15. Remaining latency (start position, warm, post-change)

```text
                 ams            ord
packed access    ~36 ms         ~36 ms      candidates stage — region-insensitive
product CPU      ~101 ms        ~99 ms      menu + evidence — region-insensitive
PG hydration     ~63 ms         ~753 ms     3 round trips: menu moves_for +
                                            games + moves complement
                                            (ord = 3×~206 ms RTT + 1.38 MB
                                            payload transfer)
DTO/other        ~10 ms         ~10 ms      JSON/DTO build outside the pipeline
                                            timings (stage medians are per-run,
                                            so the column sums are approximate)
total            213 ms         883 ms
```

The ord residual is the irreducible WAN floor of the current shape: the menu
fetch must complete before the menu builds, and the card hydration waits for
candidate generation; all queries serialize through the one facade process.

## 16. Topology decision (Phase R)

**Outcome A — batching solves it.** ord Historical Evidence is no longer
dominated by sequential PG round trips: ~10 s → sub-second, same order of
magnitude as the colocated region for a feature users read, not race. The
remaining ~640 ms ord-vs-ams delta is 3 WAN RTTs — a floor, not a
bottleneck, and it does not grow with corpus size or card count (the query
count is now constant per request).

Recommendation: **keep the existing topology** — single Fly Postgres in ams,
app regions ams + ord. No replica, no routing change, no DB relocation is
justified by any measurement in this spike. If sub-250 ms ord HE ever became
a product requirement, the smallest follow-up would be a read replica in ord
behind the same facade boundary — a separate architecture decision with its
own brief, not now.

## 17. Recommendation

```text
SHIP THE BATCHING (done — deployed 2026-09-05, v521, both regions verified)
AND CLOSE THE PARKED CROSS-REGION ISSUE.
```

Deployed and verified with the v2-cutover discipline: health first (both
regions), packed corpus opened from sidecars (~230 ms), HE probes in both
regions, memory healthy (ord MemAvailable ~214 MB after probes, no OOM),
logs clean, rollback = revert commit + redeploy (no data change). The
`[:blunderfest, :corpus, :query]` telemetry and `mix corpus.he_pg` harness
stay for future diagnosis. No further hydration work is queued.

## Repository validation

```text
mix precommit                 → format + compile --warnings-as-errors + 490 tests, green
                                (480 baseline + 10 new; no existing assertion weakened)
mix corpus.he_cpu --compare   → 9/9 DTO parity vs the pre-change snapshot
mix corpus.he_parity          → broadcast v1 ↔ v2 on the batched pipeline: 9/9 identical
mix corpus.he_bench (v2)      → GATE PASS (median 182 ms, peak 135 MB) + concurrency flat
mix corpus.he_pg              → round-trip census (45 → 2–3), RTT probe, payload tables
production verification       → both regions probed post-deploy; start DTO SHA-256
                                identical before/after in ams and ord
```

New tests (10): bulk `games/2` parity/order/dedup/missing/empty, bulk
`moves_for/2` parity incl. exact move ordering, facade delegation +
not_configured + telemetry emits, pipeline batching shape (facade trace:
one `:games` call, deduped gid arrays, zero per-card queries), missing
game/move row degradation, hydration determinism.
