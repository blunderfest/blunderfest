# Packed Corpus v2 — Phase 3: Bounded Corpus API + Historical Evidence Cutover: Implementation Report

> Date: 2026-09-05 · Task:
> `docs/packed-corpusv2-phase3-bounded-corpus-api-historical-evidence-cutover.md`
> Implements Spike 09 §13 Phase 3 (ADR-0038). Phase 2 shipped the format;
> this phase cuts the product runtime over to it. No format change, no
> repack, no concurrency-model change, no PG-topology change.

## Summary

The packed occurrence backend's product-facing APIs stopped walking
occurrence runs. Four cost-explicit primitives now serve the facade —
`position_stats/1`, `first_occurrence/1`, bounded `occurrences/2`,
explicit `all_occurrences/1` — and Historical Evidence was cut over to
them, preserving the Phase 0 architecture (request-scoped plain-map memo,
bounded candidate materialization) exactly. The known
`book_games_count` independent-game divergence (Spike 09 §12.8) was
corrected where the product semantic is "number of independent games
containing this position". Format v1 directories keep correct run-walking
fallbacks, so the retained production v1 corpus remains a usable rollback
behind a `PACKED_DIR` flip.

Headline (broadcast 1.17M corpus, warm):

```text
position_stats, start position:   156,591 µs (v1 run walk) → 39 µs (v2 metadata)
occurrences(start, limit 1):      151,918 µs (v1 reads 25.7 MB) → 49 µs (v2 reads 22 B)
start-position HE:                1,788 ms (v1 runtime) → 1,467 ms (v2 runtime)
start-position HE peak memory:    ≤ 133 MB absolute BEAM total (gate: < 300 MB) ✓
```

**The Phase 3 product gate misses on latency** (median 1,467 ms vs the
< 1 s target; memory side passes ~2.5× under). The packed-corpus portion
of the request is now ~negligible; the remaining cost is product CPU in
the family-build and card-assembly stages that Phase 3 is explicitly
forbidden to touch. See "The gate" below for the profile and the proposed
next step.

## Corpus API

Final facade surface (`Blunderfest.Corpus`, one GenServer boundary —
unchanged per the brief):

```text
API                        Cost (packed v2)                          Shape
position_stats/1           O(segment/header lookup) per segment      %{occurrences, games}
                           holding the key — never walks the run
first_occurrence/1         O(segment/header lookup) per segment      {gid, ply} | nil
                           holding the key — never opens occ.bin
occurrences/2 (limit)      O(segment lookup + min(limit, run))       [{gid, ply}]
all_occurrences/1          O(full run) — explicitly unbounded        [{gid, ply}]
occurrence_counts/1        legacy alias of position_stats/1          %{occurrences, games}
occurrences/1              legacy alias of all_occurrences/1         [{gid, ply}]
```

Semantics preserved exactly:

- `position_stats/1` returns the same `%{occurrences, games}` the
  run-walking `occurrence_counts/1` always returned (compared field for
  field by `corpus.parity` and the unit tests on both backends and both
  format versions). Postgres answers with the same `COUNT(*)` /
  `COUNT(DISTINCT gid)` query as before.
- `first_occurrence/1` equals `occurrences(key) |> List.first()` for
  every key (parity-checked at both layers).
- `occurrences(key, limit)` equals `occurrences(key) |> Enum.take(limit)`
  under the existing logical multi-segment ordering (global `(gid, ply)`
  merge).

### Multi-segment behavior

Segments' gid ranges are disjoint by pack construction (`corpus.pack`
partitions gids into non-overlapping ranges), and the manifest carries
each segment's range. `Packed.occurrences/3` checks the ranges:

- **Disjoint** (production shape): segments are visited in gid order and
  each supplies at most the *remaining global* budget —
  `min(remaining, its run length)` records, read straight from the stored
  run offset on v2. A key with 8 occurrences in segment A and 20 in
  segment B answers `limit 12` with 8 + 4 reads; segments past the spent
  budget are not queried at all (proven by test: emptying the later
  segment's occ.bin after open does not affect a prefix the earlier
  segment satisfies).
- **Overlapping/unknown ranges** (defensive; test fixtures): each segment
  contributes its first `limit` tuples and the merge re-sorts globally —
  the Phase 0 proof still applies (the global first `limit` is contained
  in the union of the per-segment first-`limit` prefixes).

`position_stats/1` sums the per-segment header counts; the sum is exact
because a game is packed exactly once and ranges are disjoint (ADR-0038).
`first_occurrence/1` takes the minimum of the per-segment header first
occurrences — exact under any interleaving (a segment's stored first
occurrence is its own minimum).

### v1 compatibility (rollback behavior)

Explicitly defined per primitive, never fabricated:

```text
v2 segment → position_stats from stored metadata; bounded reads via
             occ_run_offset prefix preads; first_occurrence from the header
v1 segment → position_stats falls back to the exact run-walking count
             (the pre-Phase-3 implementation); bounded reads keep the
             Phase 0 shape (whole run read, prefix decoded);
             first_occurrence still header-backed (v1 headers carry
             first_gid/first_ply)
mixed      → a v1 segment holding the key taints the metadata sum into an
             explicit {:error, :format_v1}; the facade then runs the exact
             whole-backend walk
postgres   → position_stats = the COUNT query occurrence_counts always ran;
             first_occurrence = the positions row's true minimum
```

Every path above is exercised by tests (unit + facade probe on both format
dirs) and by the parity tasks run against both the v1 and v2 100k
directories. A rollback is: point `PACKED_DIR` back at
`/data/corpus-packed-broadcast` (retained, never deleted) and redeploy —
no code fork, no data risk.

## Caller audit

Every previous unbounded occurrence consumer, classified and resolved:

| Caller (pre-Phase 3) | Need | Now |
|---|---|---|
| `Pipeline.card/9` list fallback (`Corpus.occurrences/1`) | Defensive fallback on facade error (unreachable once `Candidates` errors first — kept for behavior parity) | `Corpus.all_occurrences/1` — unboundedness explicit at the call site; the only `all_occurrences` product call, pinned by the audit test |
| `CountMemo` default fetcher (`&Corpus.occurrence_counts/1`) | Counts | `&Corpus.position_stats/1` (header-backed on v2) |
| `Candidates.generate` reference list | Bounded prefix (2000) | `Corpus.occurrences/2` — now a true prefix *read* on v2 (was prefix *decode* of a whole-run read) |
| `Candidates` structural scan | Bounded prefix (8/key) | same — true prefix read on v2 |
| `Corpus` facade `book_counts` (packed) | Independent-game support | v2 header `game_count` (v1: exact walk) — see below |
| `Book.for_key_packed/3` (`Packed.occurrences/2`) | Genuinely all occurrences (recomputes the next-move distribution from the run + PG moves) | Kept unbounded; tool/parity path only (`corpus.he18`, the Spike-08 parity shape) — not a live product path (the facade's `:book` route serves precomputed `book.bin`) |
| `corpus.parity` / `corpus.broadcast_parity` | Oracles — must read the full run to prove the bounded primitives | Kept unbounded by design |

Pinned by `Blunderfest.CorpusCallerAuditTest`: no product module calls the
unbounded `Corpus.occurrences/1` arity, and the single
`all_occurrences` call site is the documented pipeline fallback.

## Historical Evidence cutover

The Phase 0 structure is intact and now cheap:

- The memo remains a plain explicitly threaded map (`CountMemo`), created
  per request, no ETS / process dictionary / global cache. Its default
  fetcher is `position_stats/1`, so each distinct key costs one bounded
  header lookup instead of one run walk; the traced pipeline test asserts
  exactly one fetch per distinct key per request (the 12 exact cards share
  the reference key's single fetch).
- Candidate generation keeps its caps (`exact_limit 12`, `limit 10`,
  `bucket_limit 2000`, `scan_limit 30`, `occurrence_limit 2000`) and now
  reads only the requested prefixes from occ.bin on v2. No ranking,
  similarity, pawn-bucket, grouping, or relevance change (DTO parity is
  the proof).
- The pipeline's timings now break out `pg_ms` (the Postgres game/move
  hydration: `moves_for` + per-card `moves`/`game`) from the local/packed
  work, so the cross-region PG cost and the packed-corpus cost of a
  request can be told apart in production.

Measured effect on the HE shape (broadcast, warm): the candidates stage —
the last hot-run consumer — dropped from 330 ms (v1 runtime) to 11 ms;
per-position count calls dropped from ~35–156 ms each to ~20–40 µs.

## Independent-game semantics (`book_games_count` correction)

Classification of the count fields involved:

```text
field                         meaning                                     status
position occurrence_count     occurrences of the position                 v2 header — served by position_stats
position game_count           independent games containing the position   v2 header — served by position_stats
book per-move games           games playing each recorded continuation    unchanged (book/continuation-specific)
book-sum (book_games_count)   games playing *some recorded* continuation  NOT independent-game support
book_counts API (transposition support)  "independent games containing    corrected
                              this position"
```

`POST /api/book/counts` (the transposition candidates' support) previously
served the packed mode from the book-sum — Spike 09 §12.8 measured the
divergence from the true count: start −87,264, after-1.e4 −2,288,
after-1.d4 −1,139, Najdorf +95, A2 −1. Phase 3 serves it from the
authoritative source: the v2 header `game_count` (v1 fallback: the exact
run-walking distinct-gid count — matching the Postgres path's
`COUNT(DISTINCT gid)` semantics on rollback). `Packed.book_games_count/2`
stays available with its real meaning documented (games with a recorded
continuation), but no product path uses it as independent-game support.
The HE DTOs are unaffected (they never consumed `book_counts`).

The PG path (`Book.counts_for_keys`) already returned the true count and
is untouched — packed and PG now agree on this field instead of
systematically diverging on hot keys.

## Correctness (parity results)

All local, docker Postgres; 100k tier = PG-oracle parity, broadcast tier =
packed-vs-packed + artifact validation (no PG occurrence oracle exists at
that scale — its build OOM'd, ADR-0036/0037):

```text
mix corpus.parity --packed-dir data/corpus-packed          PARITY OK (30 s)
mix corpus.parity --packed-dir data/corpus-packed-v2       PARITY OK (29 s)
  — now includes bounded prefixes (limits 0/1/12/2000/run+7) and
    first_occurrence vs the full-list oracle for every compared key
    (10k sampled + missing/singleton/hot/same-game-dup/en-passant edges)

mix corpus.he_parity --packed-dir data/corpus-packed       9/9 DTOs identical (PG vs packed v1)
mix corpus.he_parity --packed-dir data/corpus-packed-v2    9/9 DTOs identical (PG vs packed v2)
mix corpus.he_parity --packed-dir data/corpus-packed-broadcast-v2 \
  --vs-dir data/corpus-packed-broadcast                    9/9 DTOs identical (broadcast v2 vs v1)

mix corpus.validate --packed-dir data/corpus-packed-broadcast-v2 --sample 32
  — checksums verified + 32 sampled v2 run verifications: OK
```

The known one-book-key difference (v2 carries the final book key the v1
`Stream.transform/4` bug dropped) does not touch any reference position —
the broadcast v1↔v2 DTO parity above distinguishes it from product
changes: 0 unexplained differences. v1 stays un-repacked (the rollback
artifact).

Focused unit coverage added (17 new tests, 472 total, all green):
v2 `position_stats` exactness + multi-segment summation (occurrences and
games), v1 compatibility path, missing-key stats/first/bounded reads,
`first_occurrence` parity vs the full-list oracle on v1+v2 and across
interleaved segments, bounded reads at limits 0/1/12/2000/beyond-run,
multi-segment global-limit prefix (8-from-A + 4-from-B with the later
segment provably not read fully — occ.bin truncation after open),
bounded-read-does-not-read-the-full-run proofs, facade probe tests through
the public API on both format dirs (stats/first/bounded/all/book_counts),
the `book_counts` divergence fixture (book-sum 1 vs true games 2), the
PG `first_occurrence` oracle equality, the memo's one-fetch-per-key trace,
the `pg_ms` timing, and the caller-audit guard.

## Performance

`mix corpus.he_bench` (new task: API microbenchmarks, HE stage timings,
50 ms memory sampler, start-position gate, concurrency probe), warm
corpus, local NVMe, docker PG colocated. v1 = `data/corpus-packed-broadcast`
(the Phase 0/1 runtime), v2 = `data/corpus-packed-broadcast-v2`.

### API microbenchmarks (warm p50, µs)

```text
                       v1 (run walk / whole-run read)        v2 (metadata / prefix read)
position   stats       l1     l12    l2000    stats          l1     l12    l2000
start      156,591     151,918 147,879 148,498    39          49     52     161
after 1.e4  65,894      62,380  63,415  63,370    24          34     40     130
after 1.d4  34,791      31,466  31,330  32,905    28          40     39     129
Najdorf      2,514       2,321   2,316   2,357    23          36     35     128
F1 (KID)       140         110     106     174    19          33     35      82
A2 (Ruy)       662         587     585     709    21          35     36     133
rare            26          31      31      30    25          25     25      24
endgame         18          30      26      26    17          18     17      17
```

v1 bounded cost is independent of the limit (the whole run is read
regardless — 25.7 MB for the start position); v2 scales with the prefix
(limit 1 reads 22 bytes). Stats lookups are independent of run length on
v2 — the ~1.17M-record run costs the same as a missing key (~40 µs vs
~18 µs).

### Historical Evidence (warm, default caps; stage ms)

```text
position      v1 total   v2 total   v2 stages (candidates/menu/evidence/pg)
start          1,788      1,467      11 / 878 / 510 / 69
after 1.e4       953        829       7 / 404 / 362 / 73
after 1.d4     1,379      1,241       6 / 716 / 478 / 58
Najdorf        2,969      2,989      50 / 2062 / 830 / 63
F1 (KID)       1,095      1,101      66 / 552 / 451 / 48
A2 (Ruy)         547        560      13 / 218 / 275 / 70
rare              67         70      64 / 0 / 4 / 4
endgame           10         10       4 / 0 / 4 / 4
```

(v1/v2 runs are separate sessions; Najdorf/F1/A2 totals are menu- and
bucket-cache-dominated and vary a few hundred ms between sessions — their
packed-access stages are the comparable signal. The v1 start-position HE
candidates stage was 330 ms of run reads; v2's is 11 ms.)

### The gate

Spike 09's Phase 3 product gate: start-position HE < 1 s and < 300 MB
peak.

```text
v2, 5 warm runs:  total ms 1487, 1437, 1450, 1479, 1467 (median 1,467)
                  peak MB  120.9, 96.9, 100.7, 95.9, 114.1  (absolute BEAM total)

LATENCY: MISS (1,467 ms ≥ 1,000 ms)      MEMORY: PASS (≤ 121 MB ≪ 300 MB)
```

Profile of the miss (start position, v2, warm — median run):

```text
stage            ms     share   class
menu             878    60%     Families.build over the 2000-window menu — product CPU
evidence         510    35%     per-card differences/family/skeleton assembly — product CPU
pg hydration      69     5%     22× (game + moves) + moves_for, PG colocated
candidates        11     1%     packed access — the Phase 3 objective
```

The packed-corpus portion of the request is effectively solved: every
storage-side cost the phase set out to remove is gone (counts O(log N),
prefix reads O(limit), no hot-run materialization anywhere in the path —
the memory side of the gate passes 2.5× under, flat across n=1/2/4). The
latency miss is entirely the class-E product CPU floor Spike 09 §4 already
classified ("Menu family construction — E product algorithm cost") and
Phase 3 is explicitly forbidden from optimizing (no continuation-family,
candidate-ranking, or evidence-semantics changes). Per the brief's gate
procedure: no unrelated optimization was started.

**Proposed smallest next step:** a dedicated product-CPU pass on
`Families.build` (single-linkage clustering over ≤2000 windows, 878 ms)
and the per-card comparison assembly (510 ms over 22 cards ≈ 23 ms/card —
`Differences` + `Families.membership` + `Skeleton.membership`), with the
`pg_ms` split already in place to keep the PG portion out of the
measurement. Together they are 95% of the remaining start-position cost;
no storage or access work can close the ~470 ms to the gate.

## Memory

Absolute BEAM total, 50 ms sampler (`mix corpus.he_bench`), warm;
baseline with the v2 corpus open: 115.7 MB.

```text
position      v2 HE peak    v1 HE peak    HEAD (pre-Phase 0, Spike 09)
start          96–137 MB     120–133 MB    972 MB
after 1.e4    122–144 MB     110 MB        502 MB
after 1.d4     99–104 MB      98 MB        457 MB
```

- No full hot occurrence list is materialized (bounded consumers keep ≤
  `occurrence_limit` tuples; card counts are header reads).
- No complete hot occurrence byte run is read for bounded consumers —
  proven at the segment level by the truncation tests (a prefix read
  succeeds after the run tail is removed; a read wanting the tail fails
  truthfully).
- No OOM, no growth proportional to run size: start-position HE stays at
  ~100–140 MB absolute whether the run holds 1.17M records (broadcast) or
  100k records (100k tier: 84–118 MB — the delta is the menu/evidence
  working set, not the corpus).

Concurrency probe (start position, recorded for the later GenServer
decision — not optimized on):

```text
      v2 wall    v2 peak     v1 wall    v1 peak
n=1   1,107 ms    97.0 MB    1,461 ms   111.8 MB
n=2   1,207 ms   106.1 MB    1,867 ms   103.9 MB
n=4   1,529 ms   113.8 MB    2,546 ms   132.3 MB
```

Peak memory stays flat across concurrency (HEAD pre-Phase-0 stacked to
1,429 MB at n=2); wall grows ~linearly with n — the single-GenServer
serialization, unchanged by design in this phase.

## Production deployment

**Not performed — the primary local gate (start-position HE < 1 s) missed**,
and the brief conditions the cutover on all gates passing. The v2 artifact
and the application code are cutover-ready; the decision is whether the
latency floor (class-E product CPU, out of Phase 3 scope) is acceptable
for the flip or should be addressed first. Nothing was shipped; production
still runs the v1 directory with the pre-Phase-3 application image
(v513, both machines stopped/scale-to-zero at the time of writing).

Prepared procedure (deploy credentials verified available —
`flyctl auth whoami` OK; execute only after the gate decision):

```sh
# 1. Verify the existing v2 artifact (already done locally 2026-09-05:
#    checksums + sampled runs OK). Do NOT rebuild it.

# 2. Ship the v2 directory (bins + anchor sidecars) to each region's volume:
flyctl ssh sftp put --machine <ams-machine-id> -R \
  data/corpus-packed-broadcast-v2 /data/corpus-packed-broadcast-v2
flyctl ssh sftp put --machine <ord-machine-id> -R \
  data/corpus-packed-broadcast-v2 /data/corpus-packed-broadcast-v2

# 3. Checksum-verify on each machine (manifest.json carries the SHA-256s):
flyctl ssh console -a blunderfest --machine <id>
  cd /data/corpus-packed-broadcast-v2/seg-000001
  sha256sum occ.bin pos.bin bucket.bin book.bin   # compare to manifest.json

# 4. Leave the v1 directory intact (never delete).

# 5. Switch PACKED_DIR (fly.toml [env]):
#      PACKED_DIR=/data/corpus-packed-broadcast-v2
#    (PACKED_CORPUS=1 stays).

# 6. Deploy the Phase 3 application code:
git push origin main && flyctl deploy

# 7. Verify both regions (mandatory start-position request):
curl -s https://blunderfest.org/api/health
curl -s -X POST https://blunderfest.org/api/historical-evidence \
  -H 'content-type: application/json' \
  -d '{"fen":"r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 0 8"}'   # A2
curl -s -X POST https://blunderfest.org/api/historical-evidence \
  -H 'content-type: application/json' \
  -d '{"fen":"rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 7"}'   # Najdorf
curl -s -X POST https://blunderfest.org/api/historical-evidence \
  -H 'content-type: application/json' \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"}'          # after 1.e4
curl -s -X POST https://blunderfest.org/api/historical-evidence \
  -H 'content-type: application/json' \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}'             # start (mandatory)
#    Record per request: HTTP status, total latency (timings.total_ms),
#    packed vs PG split (timings.candidates_ms vs timings.pg_ms), machine
#    health (flyctl status / flyctl logs). Repeat on the other region
#    (force via flyctl proxy or region-pinned machine).

# 8. Rollback (immediate, at any point):
#      PACKED_DIR=/data/corpus-packed-broadcast  (fly.toml) + flyctl deploy
#    or revert the commit + deploy; v1 stays on both volumes.
```

Anchor behavior carries over unchanged: the v2 directory's sidecars ship
with it (open measured 11 ms from sidecars locally; the v1 dir opens in
21 ms) — no rebuild-at-boot, no 1.21M-pread pattern.

## Remaining bottlenecks

Carried forward explicitly, unsolved by design in this phase:

1. **ord → ams PostgreSQL latency.** The `pg_ms` timing now isolates it
   per request: on the DB-colocated machine (ams) start-position PG
   hydration is ~69 ms; the Phase 0 deployment measured ord serving the
   same shape at ~9 s of cross-region round trips (22× game+moves +
   moves_for). The packed-corpus portion is now region-insensitive and
   cheap everywhere; the PG hydration is the separate parked investigation
   (batching/replica/region placement — all out of scope here).
2. **Corpus GenServer concurrency.** Reads remain serialized through the
   single facade process (wall grows ~linearly with concurrent hot
   queries; memory stays flat). Recorded above for the later
   telemetry-driven decision; nothing in this phase changes the boundary.
3. **The gate's latency floor.** `Families.build` (~880 ms) + card
   assembly (~510 ms) — class-E product CPU; proposed as the next
   dedicated pass (see "The gate").

## Repository validation

```text
mix precommit          → format + compile --warnings-as-errors + 472 tests, green
                         (455 baseline + 17 new; no warnings)
mix corpus.parity      → v1 + v2, PARITY OK (incl. Phase 3 bounded/first checks)
mix corpus.he_parity   → PG-vs-packed 9/9 on v1 and v2; broadcast v2-vs-v1 9/9
mix corpus.validate    → v2 broadcast artifact: checksums + sampled runs OK
mix corpus.he_bench    → v1 and v2 broadcast suites (tables above)
anchor open probe      → v2 11 ms / v1 21 ms, sidecar-loaded
```
