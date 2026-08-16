# Technical Spike 01 — Position Retrieval: Report

Status: complete — benchmarks at 100k / 1M / 10M games (6.7M / 67M / 673M
position occurrences). Spike brief:
[`technical-spike-01-position-retrieval.md`](technical-spike-01-position-retrieval.md).
Code + reproduction: [`spike/position_retrieval/`](../spike/position_retrieval/README.md).

> **TL;DR** — A canonical position key (placement, side to move, castling,
> en-passant-only-when-capturable) hashed to 128 bits is the right position
> identity. Exact retrieval is interactive on every serious candidate up to
> 67M occurrences, and the corpus scales linearly to 673M. The dominant
> design problem is not lookup speed but **hot keys**: the position after
> 1.e4 occurs in 59% of games, so result sets must be capped/paginated
> regardless of store. A purpose-built sorted-binary index
> (**22 bytes/occurrence**) is smallest and fastest at every tier — p50
> 12–16µs and p95 ≤ 16ms at all three tiers, including 673M rows.
> PostgreSQL is a strong baseline through the 1M tier (p50 131µs) and only
> falls over at 10M on 16GB hardware (index+heap 59GB ≫ RAM: p50 1.5ms,
> p99 68s). DuckDB loads at 6.5M rows/s but plans point lookups as
> sequential scans — the OLAP grain confirmed with planner evidence. ETS
> caps around 100k games on 16GB RAM.

## 1. Phase 1 — position representation

### The key

```
PositionKey = piece placement · side to move · castling rights · en-passant-if-capturable
```

implemented in `spike/position_retrieval/lib/position_key.ex`, with golden
fixtures in `test/position_key_test.exs` (17 tests + doctest: EP conventions,
transpositions, pinned-EP, color-flip, pawn skeleton) plus a statistical
regression test for the query-set sampler.

### What belongs in the key — and the en-passant reasoning (requested)

* **Piece placement, side to move, castling rights** — in. They define the
  legal continuation.
* **Move counters (halfmove/fullmove)** — out. History, not position.
* **En passant** — in, **but only when a legal en-passant capture exists**
  (the X-FEN/Shredder-FEN convention).

The FEN spec records the EP target square after *every* double pawn push,
even when no pawn can capture. That makes the raw EP field history-dependent
noise: `1.e4` yields `… b KQkq e3` while the identical placement reached
without a double push yields `… b KQkq -`. The two positions have identical
legal continuations, so retrieval must treat them as identical.

The corpus measurement settles it, consistently at all three tiers:

* the raw EP square is set after **7.3% of all plies**,
* a legal EP capture exists in only **1.9% of those** —
  i.e. **98.1% of raw EP fields are noise**.

Under the raw convention, the same position reached by different move orders
would get different keys ~7% of plies into every game — a systematic recall
break for exact search. The normalization costs a legality check only on
plies following a double push with an adjacent enemy pawn (cheap; the full
`legal_moves` scan runs only when a capturer is adjacent, covering the rare
pinned-EP case, fixture-tested).

Two corollaries:

* `Echecs.Game`'s built-in Zobrist hash is **unsuitable** as position
  identity: it mixes in the EP file whenever the raw square is set (the
  rejected convention), and its random keys are compile-time-seeded — an
  echecs upgrade could silently invalidate a persisted index.
* A 64-bit hash (engine convention) has a measurable birthday-collision
  probability at corpus scale (~1% at 400M positions); the spike uses
  **BLAKE2b truncated to 128 bits** (deterministic, version-stable,
  collision-negligible). Keys are stored as 16 bytes everywhere (a 32-char
  hex form in the TSV artifacts).

Text vs. binary keys were benchmarked head-to-head in PostgreSQL (100k
tier): text keys make the total store 1.6× bigger (1.03GiB vs 632MiB) and
slightly slower (p50 135µs vs 115µs). There is no reason to prefer them; the
canonical string form remains the debug/display format.

### Corpus and extraction (the import pipeline)

Source: `lichess_db_standard_rated_2017-05.pgn.zst` (CC0) — 11,693,919
games, one month, so all tiers are strict prefixes of one file.
`mix spike.extract` streams the 25GB file, replays each game's mainline with
echecs (lean tokenizer; comments/NAGs/RAVs skipped at byte level), and
writes `hash · gid · ply` per ply plus game metadata and a query sample.

| tier | games | failed | plies | plies/game | wall time | throughput |
|---|---|---|---|---|---|---|
| 100k | 100,000 | 0 | 6,714,883 | 67.1 | 104s | 64k plies/s |
| 1M | 1,000,000 | 0 | 67,348,113 | 67.3 | 17.1 min | 66k plies/s |
| 10M | 10,000,000 | 0 | 673,326,206 | 67.3 | 2h32m | 74k plies/s |

Zero parse failures in 11.1M games. Extraction is CPU-bound on SAN
resolution/move-making and parallelizes near-linearly across 8 hyperthreads.

### Corpus shape (drives everything below)

* **Most positions are unique**: distinct keys are 86.9% of occurrences at
  100k (5.83M of 6.71M), 83.5% at 1M (56.3M of 67.3M), 79.9% at 10M (538.1M
  of 673.3M). The corpus is a very long cold tail.
* **…and a few positions are everywhere**: the most frequent key (the
  position after `1.e4`) occurs in **59% of games** (5,872,744 occurrences
  at 10M). Result-set sizes for uniformly-sampled position queries:
  p50 = 1 at every tier; p95 = 779 (100k) / 4,740 (1M) / 64,355 (10M); max =
  58.7k / 590k / 5.87M.
* Consequence: lookup latency splits into a cold-key regime (sub-100µs
  nearly everywhere) and a hot-key regime governed entirely by result-set
  materialization. Misses are uniformly fast — tails are row-fetch cost,
  not search cost.

## 2. Phase 2 — benchmarks

Environment (also embedded per-run in `data/bench-*.json`): 11th Gen Intel
i5-1135G7 (4C/8T) laptop, 16GB RAM, NVMe SSD, Arch Linux, PostgreSQL 18.4
**stock config** (shared_buffers=128MB, work_mem=4MB,
maintenance_work_mem=64MB — deliberately untuned), SQLite via exqlite
(durability pragmas off for bulk load), DuckDB 1.5.5 (ART index), Elixir
1.20.2 / OTP 29. The 10M PG tier ran on a throwaway initdb cluster on the
data disk (same binaries, same defaults; the system cluster's data dir lives
on the 77GB root partition — see problem #9).

Query set per tier: 2000 hits + 500 misses, sampled **systematically**
(every k-th occurrence) from the occurrence files, 1 warmup + 3 measured
sequential passes, per-lookup wall-clock µs. Every store passed the
correctness spot-check (25 sampled occurrences must come back; 0 failures
everywhere; miss sets produced 0 false hits). (The first measurement round
used a biased sampler — see problem #10; the tables below are the corrected
numbers, from `mix spike.requery`.)

### 100k games (6.71M occurrences)

| store | load | storage (index) | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| memory-ets † | 13s | 899MiB | <1µs | 249µs | 12.9ms | 31.2ms |
| postgres bytea | COPY 27s + idx 3s | 632MiB (233MiB) | 111µs | 2.1ms | 56.7ms | 99ms |
| postgres text | COPY 27s + idx 10s | 1.03GiB (439MiB) | 135µs ‡ | 64.2ms ‡ | 119ms ‡ | 322ms ‡ |
| sqlite | insert 17s + idx 12s | 365MiB (161MiB) | 12µs | 2.7ms | 73.2ms | 165ms |
| duckdb | COPY 1s + idx 7s | 463MiB | 97ms § | 163ms | 201ms | 235ms |
| flatfile | sort 6s + pack 20s | **141MiB** (0.3MiB) | **12µs** | **88µs** | **2.2ms** | **7.6ms** |

### 1M games (67.35M occurrences)

| store | load | storage (index) | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| memory-ets | — | **does not fit** (13.4GB RSS at 16GB RAM) | — | — | — | — |
| postgres bytea | COPY 260s + idx 73s | 6.11GiB (2.21GiB) | 131µs | 13.1ms | 1.19s | 1.70s |
| sqlite | insert 143s + idx 188s | 3.67GiB (1.63GiB) | 15µs | 16.7ms | 761ms | 1.75s |
| duckdb | COPY 10s + idx 131s | 4.05GiB | 124ms § | 470ms | 1.11s | 1.58s |
| flatfile | sort 97s + pack 193s | **1.38GiB** (3MiB) | **14µs** | **459µs** | **61.9ms** | **178ms** |

### 10M games (673.3M occurrences)

| store | load | storage (index) | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| postgres bytea | COPY+idx+analyze ≈ 106 min ‖ | 59GiB (21GiB) | 1.54ms | 2.33s | 67.8s | 84.4s |
| flatfile | sort 24min + pack 32min | **13.8GiB** (30MiB) | **16µs** | **15.7ms** | **735ms** | **1.91s |

(sqlite/duckdb not run at 10M: disk budget on this laptop, and their scaling
stories are unambiguous from the two smaller tiers. memory-ets would need
~130GB RAM.)

† memory-ets load at 100k originally used `:bag` — O(run)-scans on insert
degrade it quadratically on hot keys (180k rows/s at 676k rows → 11k rows/s
at 6.7M, 10.5 min); fixed to `:duplicate_bag` (O(1) inserts, 13s /
511k rows/s). Lookup numbers are unaffected by the table flavour.

‡ postgres/text was measured in the first (biased-sample) round and retired
before re-measurement: it is strictly dominated by the bytea variant
(bigger and slower), so the corrected numbers were not collected.

§ duckdb's "point lookups" are full scans: `EXPLAIN` shows `SEQ_SCAN` with
the ART index present (even after ANALYZE; DuckDB 1.5.5 uses ART primarily
for constraint enforcement). Its p50 ≈ scan time of the table. The first
run's lower p50 (552µs at 1M) could not be reproduced with planner evidence
pointing at scans; treated as an open oddity, immaterial to the verdict.

‖ the 10M PG load timing printout was lost to a harness bug (since fixed);
the total was reconstructed from data-file mtimes. The 100k/1M splits show
COPY ≈ 250k rows/s and index builds growing superlinearly (3s → 73s).

## 3. Phase 3 — what the candidates taught us

**PostgreSQL (baseline).** Linear COPY throughput (~250–260k rows/s at all
tiers), index builds superlinear but manageable. Through the 1M tier it is
unimpeachable for exact retrieval: p50 131µs, p95 13ms. At 10M it breaks on
this hardware: index+heap (59GB) far exceeds RAM, its own multi-GB hot-key
scans thrash the page cache, and the honest numbers are p50 1.5ms / p99 68s.
With more RAM (or capped result sets) the 10M shape improves substantially —
but the measured reality is: fine at ≤67M rows, needs hardware/tuning beyond.

**SQLite.** Fastest row-store insert (472k rows/s), smallest database file,
best database p50 (12–15µs — embedded, no round trip). Tails track PG's
shape but land 2–10× better at p99. Operationally the zero-infra option;
single-writer is a non-issue for a batch-built corpus. A genuinely
surprising contender: at the 1M tier it beats PG on every axis measured.

**DuckDB.** Absurd bulk load (6.5–6.8M rows/s — columnar CSV reader), and
that is its only relevance here: point lookups plan as sequential scans
(planner evidence captured), so its p50 *is* a table scan (97ms at 6.7M
rows, 124ms at 67M). The wrong grain for interactive retrieval; the right
tool for offline corpus analytics (distributions, prefilter-bucket design).

**ETS (in-memory reference).** p50 < 1µs — the speed of light. Also the RAM
ceiling, measured: ~140B/occurrence ⇒ 6.7M rows = 0.9GB (fits), 67M rows =
13.4GB (doesn't fit a 16GB laptop). In-memory-only caps out around the 100k
game tier on this hardware.

**Flatfile (sorted packed binary + sparse anchors).** 22 bytes/occurrence:
4.4× smaller than PG, 2.7× smaller than SQLite. Fastest or tied-fastest p50
at every tier (12–16µs), and the tail stays interactive through 673M rows
(p95 15.7ms at 10M) because a hot-key run is one sequential read. Its p99 at
10M (735ms) is the 129MB read + tuple materialization of the top keys — the
occurrence-cap answer applies. Build cost: external sort + pack (56 min at
10M). Real constraint: rebuild-oriented writes (see §6).

## 4. Problems encountered (surprises documented)

1. **The raw EP field is almost entirely noise** (98.1%, corpus-measured at
   three tiers) — the key-convention decision is the Phase 1 headline.
2. **ETS `:bag` inserts scan the key's run** — quadratic on hot keys
   (180k → 11k rows/s). `:duplicate_bag` fixes it.
3. **PG text-format COPY unescapes `\xHH` before the bytea parser**, so
   bytea hex needs a *double* backslash (`\\x…`) — a raw `\x` prefix
   corrupts the stream with a UTF8 error.
4. **Corpus player names contain non-UTF-8 bytes** (latin-1) — PG rejects
   them; the extractor now sanitizes (UTF-8-or-latin-1 fallback).
5. **Hot-key result sets are a product-design problem, not a store
   problem**: every candidate's p99 is result materialization (PG at 10M:
   84s for a 5.87M-row fetch). "All occurrences" needs a
   cap/pagination/aggregation answer before any UI.
6. **A quadratic accumulator (`acc ++ matches`) only showed up at
   590k-occurrence runs** — tail-latency bugs hide below hot-key scale; why
   the benchmark samples across the whole corpus, openings included.
7. **echecs' Zobrist** uses raw-EP semantics and compile-time-seeded keys —
   unusable for a persisted corpus index (see Phase 1).
8. **echecs replay throughput** (~66–74k plies/s parallel incl. keying) sets
   the 10M extraction at 2.5h — import is CPU-bound on SAN resolution, not
   IO.
9. **The system PostgreSQL data dir lives on a 77GB root partition** — the
   10M tier's index build exhausted it mid-run (`disk_full`). The spike DB
   on the system cluster was dropped, and the 10M tier ran against a
   throwaway `initdb` cluster inside the data directory. A reminder that
   "just run Postgres locally" hides filesystem layout; on Fly this is a
   volumes question.
10. **The extraction-time reservoir sampler was biased** (found by
    validating the sample against `shuf`): the eviction step used
    `Enum.drop/2`, which drops a *prefix* instead of a random element —
    overrepresenting batch-boundary plies, i.e. hot keys (the 1.e4 position
    ~5× overrepresented; the giveaway was `occurrences p95` printing the
    single hottest key's exact count). Fixed (`List.delete_at/2` + a
    statistical regression test) and all stores were **re-measured with a
    corrected systematic sample** (`mix spike.requery`). All stores saw the
    same biased set, so comparisons were fair and conclusions unchanged;
    the absolute tail numbers were pessimistic (e.g. flatfile 1M p95
    34ms → 0.46ms; PG 1M p95 707ms → 13.1ms).
11. **A DBConnection 15s default timeout kills hot-key queries** at the 10M
    tier (multi-second fetches) — the lookup path now passes
    `timeout: :infinity`.

## 5. Phase 4 — fitness for future similarity queries

Probed on the 100k tier (`mix spike.probes`), plus analysis:

| query class | mechanism | verdict |
|---|---|---|
| **Exact** | this benchmark | ✅ p50 12–131µs at 67M rows |
| **Color-reversed** | transform the canonical key string (case swap + rank mirror + side/castling swap) + a second exact lookup | ✅ trivially supported by any exact index; measured double-lookup p50 26µs. Corpus reality: the reversed twin exists in only **1.6%** of sampled positions (100k bullet games) — cheap mechanism, sparse matches |
| **Structural (pawn skeleton)** | derive a pawn-only key from the canonical string at index time; exact lookup into a skeleton bucket | ✅ same machinery (a second derived index). Selectivity at 100k: 5.83M distinct full keys → 1.48M distinct skeletons (~4 positions/skeleton; the ratio grows with corpus size) |
| **Relaxed (tolerated differences)** | candidate generation beyond exact keys | ⚠️ **not servable by exact indexes** — this is the class that forces ADR-0010's piece-map decomposition (or embeddings later). Retrieval becomes "prefilter buckets → candidate set → score with user weights" |
| **Contextual (preceding/following moves)** | occurrences carry (gid, ply) — per-game ply windows are a range query | ✅ no fundamental barrier; schema addition (prev/next move columns, or a gid-ordered second index for the flatfile) |

The representation is compatible with everything on the roadmap; relaxed
similarity is the only class needing a different *retrieval* mechanism, and
it layers on top of (not instead of) the exact index.

## 6. Recommendation

> **If we implemented Analyze tomorrow, what would we choose?**

1. **Position identity: the canonical key as specified here** (EP only when
   capturable; 128-bit BLAKE2b binary form). Done, tested, corpus-validated.
2. **Storage: durable PGN corpus + derived packed-index files**, built by a
   background job (the storage-options "rooms trick", now with numbers):
   22B/occurrence, best measured p50 *and* tail at every tier, zero new
   infrastructure, and philosophically identical to ADR-0001 (the index is
   recomputed from the corpus; the corpus is the only durable thing).
   100M positions ≈ 2.2GB of index; 1B positions ≈ 22GB — disk, not RAM.
3. **PostgreSQL remains the fully-viable alternative** when we want
   incremental imports, metadata-rich queries (player/rating/date filters),
   or contextual queries early. Its measured 1M-tier numbers (p50 131µs)
   are interactive-ready; its costs are operational (a service to run, a
   filesystem to size) and, past the RAM boundary, tuning. The spike found
   no reason to *rule it out* — and no performance reason to *require* it.
   (Also: SQLite out-measured PG at 1M on every axis here; if a single-file
   relational store is ever enough, it is the cheapest correct choice.)
4. **Cap occurrences in any product UI** (e.g. first N occurrences + total
   count): the hot-key tail is the only latency problem that matters, and
   it's orthogonal to the store.
5. **Not for this workload**: DuckDB (interactive retrieval; keep it for
   offline corpus analysis), ETS-only (RAM ceiling), text keys (strictly
   dominated).

Known boundary of the flatfile shape: rebuild-oriented writes. A rebuild is
~5 min at 1M games, ~1h at 10M (sort 24min + pack 32min); at 100M games it
would be most of a day — if the corpus grows that far with frequent imports,
introduce sorted-run merging (LSM-ish) or switch lanes to PostgreSQL then.
That is exactly the "not irreversible" boundary the spike brief asked to
keep.

## 7. Suggested next investigations

* Occurrence-cap design: precomputed counts + capped occurrence lists;
  re-measure under that contract (the tail mostly disappears).
* The similarity retrieval lane per ADR-0010: piece-map layout on top of the
  packed format (or in PG/SQLite), golden fixtures for the metric.
* Concurrency/throughput benchmark (this one is single-reader latency).
* PostgreSQL with tuned config and/or more RAM (shared_buffers=4–8GB) —
  quantify the 10M recovery; informs "if PG, how much tuning".
* Incremental-index design (sorted runs + merge) when corpus growth demands
  it.
* The unexplained fast first DuckDB run (552µs p50 with planner evidence of
  scans later) — a footnote, but an honest loose end.
