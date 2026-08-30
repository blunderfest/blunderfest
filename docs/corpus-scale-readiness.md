# Corpus scale readiness

How the corpus read path behaves as the game count grows, what breaks first,
and the documented trigger for replacing the index. This is a posture note,
not a decision: the decisions live in ADR-0026 (PG behind the `Corpus`
boundary), ADR-0027 (PG as the v0 index), and ADR-0035 (read-path
responsiveness).

## Where the data is

Four rebuildable tables behind `Blunderfest.Corpus` (ADR-0026, Postgrex, no
Ecto; UNLOGGED; rebuilt from the extraction artifacts):

| Table | Rows | Growth driver |
|---|---|---|
| `corpus_positions` | one per **distinct** canonical position | ~distinct positions across all games |
| `corpus_occurrences` | one per **(key, gid, ply) occurrence** | total positions seen — the big table || `corpus_games` | one per game | game count |
| `corpus_moves` | one per game | game count |

`corpus_occurrences` is the growth-sensitive one: it stores a row **per
occurrence** (a game that reaches a position 5 times stores 5 rows), keyed by
a 128-bit hex `key` text column with a btree on `key`. Since the ply-0
extraction (2026-08-30) every game also contributes its initial position
(`ply = 0`), so the start position carries a full count of the corpus's
games. Everything else is a small, key- or gid-indexed lookup.

## What the read path costs

The two hot endpoints:

- `GET /api/book?fen=…` — next-move W/D/B stats for one position. Since
  ADR-0035 the aggregation runs **in SQL** (one grouped query returning one
  row per `(move, result)`), so a hot position returns a handful of rows
  instead of pulling every occurrence into the BEAM. Cost is dominated by the
  `key` btree lookup + the join, roughly proportional to the position's
  occurrence count, **not** the total corpus size.
- `POST /api/book/counts` — independent-game counts for a batch of FENs (the
  transposition candidates). One `COUNT(DISTINCT gid) … WHERE key = ANY($1)`
  query; scales with the matched occurrence count.

The expensive path is the historical-evidence pipeline (ADR-0027): measured
**170–354 ms on the 100k-game corpus**, comfortably interactive. Its cost
scales with candidate count and per-candidate occurrence fan-out, capped by
explicit limits (12 exact, 40 structural, 2000 bucket keys).

## The one structural bottleneck

**Every corpus query is serialized through the single `Blunderfest.Corpus`
GenServer** with `:infinity` timeouts (`corpus.ex`). This is deliberate: it
keeps the physical representation replaceable (PG today, the packed binary
index later) behind one surface. The cost is that a slow query (a cold page
cache, a big evidence pipeline run) queues every other corpus read behind it.

We do **not** fix this with a task pool now — that would break the
replaceability story by spreading the representation across concurrent
processes. The documented escape is the packed binary index, at which point
the read path becomes memory-mapped lookups with no PG round-trip and no
single-process queue.

## The trigger (from Spike 03 §10.2)

Move occurrences to the packed binary index (Spike 01: ~22 bytes/occurrence,
p50 12–16 µs) when **any** of:

- corpus grows past **~5–10M games**;
- import frequency makes PG rebuilds painful (rebuild time scales with
  occurrence count);
- a measured query mix needs the flatfile's tail latency (PG p99 degrades as
  `corpus_occurrences` outgrows the buffer cache).

None apply at 100k games. The 1 GB prod VM and the single-region corpus make
PG the right size today.

## What to watch as it grows

1. **`corpus_occurrences` size vs. buffer cache.** Once the `key` btree no
   longer fits in memory, `WHERE key = $1` lookups go from ~1 ms to disk-bound.
2. **Evidence-pipeline tail latency** (ADR-0027's 170–354 ms) — watch the
   candidate caps and the structural-bucket fan-out as distinct positions
   multiply.
3. **GenServer queue depth** — if book/evidence requests start visibly
   queuing behind each other under real concurrency, that is the serialization
   bottleneck surfacing, and it argues for the packed index, not a pool.
4. **Rebuild duration** — the COPY load is the operational cost of a rebuild;
   when it becomes the bottleneck on import cadence, that is signal #2 above.

## Not done (deliberately)

- No task pool / read concurrency behind the facade (breaks replaceability).
- No `corpus_occurrences(gid, ply)` composite index (the book query's join
  order already filters by `key` first; revisit only if measured).
- No materialized book table (precomputing per-position W/D/B) — the grouped
  SQL is fast enough at this scale; revisit if hot positions get slow.
