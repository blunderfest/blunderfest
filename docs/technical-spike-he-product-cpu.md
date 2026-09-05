# Historical Evidence Product CPU — Families.build + Card Assembly: Spike Report

> Date: 2026-09-05 · Brief:
> `docs/historical-evidence-product-cpu-families-build-card-assembly.md`
> Scope: the class-E product-CPU floor left after the Packed Corpus v2
> cutover (Phase 3) — `Families.build` and the per-card evidence assembly.
> No storage, corpus-format, candidate-semantics, PG-topology or Corpus
> GenServer change. All local, docker Postgres colocated, broadcast 1.17M
> corpus, packed v2 directory (`data/corpus-packed-broadcast-v2`), warm.

## 1. Executive verdict

```text
baseline (warm start-position HE, v2):  median 1,432–1,467 ms (menu 861 / evidence 497)
best safe result:                       median 159 ms (menu 54 / evidence 54)
< 1 s gate:                             PASS (median 160 ms, 5-run gate)
< 300 MB gate:                          PASS (peak ≤ 146 MB)
semantics changed:                      NO — 9/9 DTO parity vs the pre-change
                                        baseline, 9/9 broadcast v1↔v2 parity,
                                        family menus bit-identical to a naive
                                        reference implementation, 480 tests green
```

The sub-1-second gap was an **implementation problem, not a product-semantics
cost**. Four semantics-preserving changes — frequency-map hoisting in the
clustering pair loop, union-by-rank, a request-local membership index, and an
exact single-linkage pair-skip — cut the start position 9× with the output
byte-identical at every step. Recommendation (§15): ship the optimization with
the Phase 3 v2 runtime cutover.

## 2. Baseline reproduction (Phase A)

`mix corpus.he_bench` + the new spike harness `mix corpus.he_cpu` (this
spike's benchmark/parity/profiling task). Warm v2 corpus, one warm-up touch
per position first.

Start position, 11 consecutive warm runs (stage ms: candidates/menu/evidence/pg):

```text
run:    1      2      3      4      5      6      7      8      9      10     11
total   1428   1464   1449   1441   1440   1411   1415   1440   1430   1430   1432
menu     871    864    861    837    851    839    834    862    841    841    842
evidence 490    552    544    555    539    538    549    534    552    544    552
pg        76     60     55     60     62     42     43     55     49     56     48

min 1411 / median 1432 / p90 1449 / max 1464 ms
```

The 5-run gate protocol of `he_bench` gave 1454, 1458, 1457, 1455, 1450
(median 1455) in the same session — matching the Phase 3 report's median
1,467 ms. Variance is tight (±2%); Phase 3's separate n=1 concurrency probe
of 1,107 ms was methodology noise (a single untimed-adjacent run), not a
faster steady state — see §12.

All eight permanent positions (warm, stage ms):

```text
position       total   candidates / menu / evidence / pg
start          1,419       9  / 861 / 497 / 72
after 1.e4       823      17  / 393 / 375 / 53
after 1.d4     1,289      17  / 731 / 492 / 62
Najdorf        2,957      49  / 2070 / 784 / 74
F1 (KID)       1,123      82  / 568 / 434 / 51
A2 (Ruy)         560      26  / 223 / 253 / 72
rare middlegame   67*       –  /   0 /   4 /  4
cold endgame      10*       –  /   0 /   4 /  4
```

(*The baseline session measured rare/endgame candidates at 937/88 ms on the
first touch — a cold bucket-bin page-cache effect; warm steady state is
61–67/5–9 ms, unchanged by this spike. Menu/evidence are the signal.)

## 3. CPU profile (Phases B/C)

`:cprof` call counts and `:eprof` time attribution over one start-position
`Pipeline.analyze` (both via `mix corpus.he_cpu --cprof / --eprof`; packed
reads and PG hydration run in other processes, so attribution is product CPU
only). OTP `:tools` needed an explicit code-path load in the harness — the
modules exist in the distribution but are not on Mix's path here.

Top call counts (one start-position request):

```text
Families.find/2                      7,877,325   recursive union-find walks
Continuation.jaccard/2                 212,717   = 173,755 clusters
Enum.frequencies/1                     425,434           + 12,980 family membership
Enum.uniq (jaccard key union)        ~2,600,000          + 25,960 skeleton membership
Continuation.similarity/3              186,735           + 22 Differences.continuation
Families.sim_repr/1                    186,735   once per pair (hoistable)
Skeleton.action/1                      155,232   = 25,960 member represents × ~6 tokens
Regex.run (inside action/1)            155,231
Skeleton.represent/3                    25,982   per card × 2 sides × 590 members
Continuation.by_side/2                  25,982
Families.union/3                        15,072   pairs reaching the threshold
```

`:eprof` time attribution (µs, traced-module time; untraced callees —
Enum/Map/Regex — accrue to their traced caller):

```text
Families trace (menu 994 ms that run):
  '-clusters/3-fun-2' (pair loop body)   522,040 µs / 173,755 calls (3.0 µs/pair)
  find/2                                 443,639 µs / 7,877,325 calls
  '-membership/3-fun-2'                   41,096 µs / 12,980 calls
Continuation trace:
  jaccard/2 (+ inner reduce)             778,817 µs / 212,717 calls (3.66 µs/call)
Skeleton trace (evidence 481 ms that run):
  action/1                               326,060 µs / 155,232 calls (78.9%)
  color_sim/3                             35,787 µs / 25,960 calls
  represent/3                             25,168 µs / 25,982 calls
```

The profile and the hand-instrumented stage timings agree: the 878 ms menu is
the pair loop (~⅔) plus the degenerate union-find (~⅓); the 510 ms evidence
stage is member re-tokenization (~⅗) plus membership jaccards.

## 4. Families.build analysis (Phase F)

```text
n (entries)                2000 exact occurrences (occurrence_limit)
non-empty 6-ply windows    1960
distinct windows (m)        590          (start; Najdorf: 876)
comparison count            173,755 = m·(m−1)/2   (Najdorf: 383,250)
pairs reaching threshold     15,072   (Najdorf: 11,889)
families                        12    (Najdorf: 36)
largest family                 577 of 590 members  (Najdorf: 831 of 876)
```

The ~845 ms menu was dominated by, in order:

1. **The O(m²) comparison count** — mathematically required by exact
   single-linkage in the worst case (every cross-component pair must be
   certified below threshold). With m=590 that is 173,755 pairs — not
   avoidable by algorithm shape at current semantics.
2. **An expensive comparison function** — each `jaccard/2` recomputed
   `Enum.frequencies` of *both* members (2×425k calls), concatenated the key
   lists and ran `Enum.uniq` (~2.6M iterations) — 3.66 µs per comparison
   where a small-map intersection costs ~0.3 µs. This is where the 845 ms
   mostly went (~500 ms).
3. **A degenerate union-find** — naive attach-without-rank turned the parent
   map into a ~577-deep chain; `find/2` recursed 7.9M times through
   `Map.fetch!` (~300 ms). Single-linkage needs ~30k find steps here, not
   7.9M.
4. Redundant `sim_repr/1` per pair and per-card re-representation of members
   (see §5) — small individually, hoisted anyway.

Not the cause: input prep/grouping (~15 ms), cluster aggregation and sorting
(<5 ms), the MapSet game-union work (<1 ms). The clustering definition
(single-linkage at multiset-Jaccard ≥ 0.5, window 6) was never touched.

## 5. Card assembly analysis (Phase G)

22 cards (12 exact + 10 structural); baseline ~510 ms ≈ 23 ms/card. Per-card
trace (start):

```text
work per card                                            baseline cost
Skeleton.membership: 2 sides × 590 members               ~17 ms/card
  — member skeleton re-tokenized per card (by_side +     (the 326 ms regex
    6× regex action/1 + sort), then per-color jaccard     total)
Families.membership: 590 members                         ~2.5 ms/card
  — member metric representation re-sorted + jaccard
  (both frequencies recomputed) per card
Differences.positional + continuation (LCS ≤12×12)       ~0.3 ms/card
Route.compare (≤ ply prefix walk)                        ~0.1 ms/card
card_counts (memoized position_stats)                    ~0 ms after first
PG game+moves hydration                                  excluded (pg_ms)
```

The work is **not** independent per card: every card re-derives the same
590 member representations (22× for the family metric, 44× for the skeleton
— once per side) and the same member frequency maps. The card-specific part
is only the candidate's own window representation (one per card). Common
inputs recomputed: member representations 12,980 + 25,960 times where 590
suffice; member frequencies likewise.

## 6. Computation graph (Phase D)

```text
                          start-position request
 Candidates.generate ── exact_occurrences (2000) ──┐
       │                                            │
       │ 22 candidates                    moves_for (PG, batched, excluded)
       ▼                                            ▼
 (per card)                              Families.build
   Differences ×2                          group 1960 windows → m=590 distinct
   Route.compare                           173,755 pair similarities   ◄── all the menu CPU
   card_counts (memo: 1 fetch/key)           15,072 unions (find ×7.9M — degenerate)
   Families.membership ─── 590 sims ──┐    12 families (577-member chain)
   Skeleton.membership ── 1180 sims ──┤         │
     each re-tokenizing all 590       │         ▼
     members (regex) per side         └── member representations
                                          recomputed 22×/44× per request
 DTO: Skeleton.represent ×590 (family white/black actions)
```

Answer to the phase question: the CPU was spent **recomputing the same
derived values** (frequencies ~425k times for 590 distinct multisets; member
representations 26k times for 590 members) and on a data structure that made
union-find quadratic-in-depth — not on inherently required work. The pair
count itself (173,755) is the one inherent component, and it is now swept
with a cheap comparison and an exact skip (§8, experiment D).

## 7. Optimization candidates (Phase E, ranked)

| # | Candidate | Impact | Semantic risk | Complexity |
|---|---|---|---|---|
| 1 | Precompute frequency maps for the cluster pair loop (`jaccard_freq`) | ~500 ms | none — identical Jaccard value | small |
| 2 | Union-by-rank in the linkage find | ~300 ms | none — partition invariant | small |
| 3 | Request-local member index (family + skeleton representations once per request) | ~440 ms | none — same values, threaded map | medium |
| 4 | Exact single-linkage pair-skip (connected endpoints never compared) | ~140 ms | none — skipped unions are no-ops | small |
| 5 | Regex-free `Skeleton.action` (binary matching) | ≤10 ms after #3 | low (output-identical parser) | medium — rejected: not worth the parser risk once #3 removed the repetition |
| 6 | Reuse member skeletons in the DTO (`family_dto`) | ~10 ms | none | rejected: would add fields to the internal menu shape; DTO cost stays 10–20 ms |
| 7 | Loop fusion in the card (diffs+membership in one pass) | ~0 | – | rejected: nothing left to fuse after #3 |

Rules honored: plain explicitly-threaded maps, no ETS, no process
dictionary, no global/cross-request cache, no candidate-cap or threshold
change.

## 8. Experiments (Phase H) — one at a time, parity after each

Baseline per experiment: start warm median 1,432 ms (menu 845 / evidence 490),
9-position DTO snapshot taken on the untouched code (`he_cpu --snapshot`).

| Experiment | Change | Timing (start median) | Memory | DTO parity | Verdict |
|---|---|---|---|---|---|
| A | `Continuation.jaccard_freq/2` + per-sequence frequency maps in `clusters`; `sim_repr` hoisted out of the pair loop; `jaccard/2` delegates to `jaccard_freq` | 1,432 → 886 ms (menu 845→320) | no observable change | 9/9 identical | accepted |
| B | union-find threads `{parent, rank}`, union by rank (`find` depth O(log n); the 7.9M-step chain gone) | 886 → 739 ms (menu 320→195) | none | 9/9 identical | accepted |
| C | `Families.member_index/3` + `membership_indexed/3` + `Skeleton.membership_indexed/5`; pipeline builds the index once after `Families.build` (inside the menu timing) and threads it to every card; legacy functions untouched as the oracle | 739 → 313 ms (evidence 490→52) | + a few MB request working set | 9/9 identical | accepted |
| D | exact pair-skip in the sweep: endpoints already connected are never compared (explicit row recursion; same pair order, same unions) | 313 → 153 ms (menu 195→53) | none | 9/9 identical | accepted |
| E (regex-free `action/1`) | – | – | – | – | rejected: after C the regex runs drop from 155k to ~4k per request (~8 ms); a hand-rolled SAN parser is not worth the risk |

Experiment D measured on all eight positions (no class regressed — every
position improved or held; rare/endgame have no menu):

```text
position       before D   after D
start              313       153
after 1.e4         ~135      128
after 1.d4         ~140      139
Najdorf            ~430      375
F1 (KID)           ~215      202
A2 (Ruy)           ~125      120
```

Each experiment's parity evidence: §10. Failed/rejected experiments left no
code behind (E never landed; nothing to revert).

## 9. Final implementation

Exactly four production changes, all semantics-preserving, all behind the
existing module boundaries:

1. `lib/blunderfest/corpus/analysis/continuation.ex` — `jaccard_freq/2`
   (Jaccard from precomputed frequency maps; exactly `jaccard/2` with the
   frequencies hoisted); `jaccard/2` now delegates to it.
2. `lib/blunderfest/corpus/analysis/families.ex` —
   * `clusters/3` pair sweep: per-sequence frequency maps for the jaccard
     metrics (`:multiset`/`:piece_dest`/`:piece`), representation kind
     resolved once, and the exact connected-pair skip (`sweep_rows`); the
     `:lcs` metric and a defensive fallback keep the original shape;
   * union-find threads `{parent, rank}` and unions by rank;
   * `member_index/3` — the request-local per-member precomputation (family
     metric representation + frequencies, skeleton representation +
     per-color frequencies);
   * `membership_indexed/3` — `membership/3` over the index (legacy path
     kept byte-identical; shared result tail `membership_result/2`).
3. `lib/blunderfest/corpus/analysis/skeleton.ex` — `membership_indexed/5`
   (same scores/result shape as `membership/6`, precomputed member
   skeletons; shared `side_result/2`).
4. `lib/blunderfest/corpus/search/pipeline.ex` — builds the member index
   once per request right after `Families.build` (inside the menu stage
   timing) and threads it into `card/9`; the card scores via the indexed
   variants. The index dies with the request, exactly like the count memo.

New tooling (kept, documented): `mix corpus.he_cpu` — the spike harness
(repeated HE runs with variance stats, the computation graph, `--eprof` /
`--cprof` hooks, and `--snapshot/--compare` DTO parity over the 9 reference
positions).

## 10. Correctness (Phase I)

* **Full HE DTO parity** — pre-change snapshot (`he_cpu --snapshot`) vs the
  final code (`he_cpu --compare`): start, 1.e4, 1.d4, Najdorf, F1, A2, rare,
  endgame, same-game dup — **9/9 identical, 0 unexplained differences**,
  re-run after every experiment.
* **Backend parity** — `mix corpus.he_parity --packed-dir
  data/corpus-packed-broadcast --vs-dir data/corpus-packed-broadcast-v2`:
  **9/9 identical**. (The 100k PG-oracle flavor needs the 100k occurrence
  tier in the local PG, which the broadcast promotion parked; the backend
  layer is untouched by this spike anyway.)
* **Family parity (broader sample)** — the optimized `Families.build`
  compared term-for-term against a verbatim naive reference implementation
  (full sweep, per-pair frequencies, attach-left union-find) on the real
  2000-entry menus of start, 1.e4, 1.d4, Najdorf, F1, A2: **IDENTICAL on
  all six** (family count, membership, ids, ordering, singletons). A
  randomized property test pins the same equality (multiset/lcs/piece_dest
  settings) in the suite.
* **Skeleton parity** — `membership_indexed` ≡ `membership` asserted for
  every window × {ref_stm, cand_stm} pairing in the suite; the DTO snapshot
  carries every card's skeleton result end-to-end.
* **Differences parity** — module unchanged; covered by the DTO snapshot.
* **Request isolation** — the index is a plain map created in
  `do_analyze` and threaded through `card/9`; no ETS/global/process
  dictionary. A pipeline test asserts interleaved requests for different
  positions each return exactly their standalone result.
* **Tests** — 480 green (472 baseline + 8 new: jaccard_freq equivalence
  incl. a 400-pair randomized property, naive-build parity across three
  metric settings, indexed-vs-legacy family membership (multiset + lcs),
  indexed-vs-legacy skeleton membership (all stm pairings), request
  isolation). No existing assertion weakened.

## 11. Performance (before/after, warm v2 broadcast)

```text
position        baseline total   after    baseline menu/evidence   after menu/evidence
start              1,467*         160          861 / 497              58 / 45
after 1.e4           829          116          393 / 375              39 / 37
after 1.d4         1,289          128          731 / 492              38 / 45
Najdorf            2,957          374        2,070 / 784             184 / 92
F1 (KID)           1,123          212          568 / 434              64 / 47
A2 (Ruy)             560          120          223 / 253              22 / 34
rare middlegame       67           68            0 / 4                 0 / 5
cold endgame          10            9            0 / 4                 0 / 4

* Phase 3 gate median; this session's baseline median was 1,432–1,455.
```

Start-position request, 11 warm runs, final code:

```text
total ms: min 148 / median 159 / p90 166 / max 168
stage ms (median): candidates 7 / menu 54 / evidence 54 / pg 55
analyze + DTO construction: 152–180 ms (DTO build ≈ 10–20 ms, unchanged)
```

API microbenchmarks (packed access) unchanged — sanity that nothing touched
the store: start `position_stats` p50 21 µs, `occurrences` limit 2000 p50
125 µs.

## 12. Memory / GC (Phase K) and variance (Phase L)

* Peak absolute BEAM total, 50 ms sampler, start position, 5 gate runs:
  140.7 / 124.7 / 146.0 / 99.8 / 120.9 MB — the baseline band (96–137 MB)
  with the index's small per-request working set; **≪ 300 MB gate**, ~2×
  headroom kept. Concurrency probe: n=1/2/4 peaks 97/113/142 MB (flat, as
  before).
* No new persistent state; the index and its frequency maps die with the
  request. No GC regression observed (peak stays in-band while CPU dropped
  9× — the working set shrank with the removed re-allocation).
* Variance: the warm steady state is tight (p90 − min = 18 ms on 11 runs).
  Phase 3's 1,467-vs-1,107 spread was a single-probe artifact, not bimodal
  behavior; nothing JIT/cache-warmness related survives the warm-up touch.
  Benchmark protocol (reproducible): warm one touch per position, discard
  nothing, report all runs + min/median/p90/max; gate = 5-run median.

## 13. Gate result

```text
start median:        160 ms   (5-run gate: 160, 156, 164, 154, 163)
start p90/p95:       166 / 168 ms  (11-run session)
peak memory:         146 MB   (max of the 5 gate runs)
<1s   PASS
<300MB PASS
```

## 14. Remaining bottlenecks

```text
stage                    start (warm)   notes
Families CPU             ~54 ms         residual pair sweep (evaluated pairs after the
                                        skip) + grouping + index construction (~15 ms);
                                        the comparison count itself is the inherent floor
card assembly CPU        ~54 ms         12,980 + 25,960 cheap jaccard_freq lookups,
                                        per-card LCS/route; no recomputation left
PG hydration             ~40–75 ms      22× (game + moves) + moves_for — now the largest
                                        single share; cross-region remains parked (brief §N)
packed access            ~5–10 ms       candidates stage — solved by Phase 3
DTO + JSON               ~10–20 ms      outside the pipeline timing; family skeleton
                                        re-representation (candidate #6, rejected)
```

## 15. Recommendation

**SHIP SAFE CPU OPTIMIZATION + PROCEED TO V2 CUTOVER.**

Outcome A of the brief: exact parity preserved, both gates pass with large
margin (160 ms vs 1,000 ms; 146 MB vs 300 MB), all eight benchmark positions
faster, no semantic change anywhere in the evidence output. The optimization
lands on `main` with this report; the Phase 3 production cutover procedure
(ship the v2 directory, flip `PACKED_DIR`, deploy, verify, v1 rollback)
stands as written in `docs/packed-corpus-phase3-runtime-cutover.md` — not
executed here (the brief requires explicit authorization for deployment).
The parked cross-region PG investigation stays parked: `pg_ms` is now the
largest single share of a warm start request, and it is exactly the number
that cross-region work addresses.

## Repository validation

```text
mix precommit                 → format + compile --warnings-as-errors + 480 tests, green
mix corpus.he_parity          → broadcast v1 ↔ v2: 9/9 identical
mix corpus.he_bench (v2)      → tables above; GATE PASS
mix corpus.he_cpu --compare   → 9/9 DTO parity vs the pre-change snapshot
family parity script          → optimized vs naive build: IDENTICAL on all six hot menus
```
