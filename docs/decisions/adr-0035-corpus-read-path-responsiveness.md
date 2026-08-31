# ADR-0035: Corpus read-path responsiveness — SQL aggregation, cache headers, visible loading

Status: Accepted (2026-08-30)

## Context

Three observations from playing through a game against the 100k corpus: the
opening-book W/D/B bars were slow to appear on a cold instance and it was
impossible to tell a slow fetch from a position with no data (the book rows
render instantly from the local book; the stats pop in whenever
`/api/book` resolves, with no affordance); and the question of how the site
holds up as the corpus grows kept coming up without a written answer.

Two concrete problems fell out:

1. **No loading/error affordance.** `ReferencePanel` rendered rows with an
   empty gap until `/api/book` resolved; a failed fetch silently left the rows
   bare. The find-CTA and transposition branch had explicit states; the book
   rows — the most-visited case — had none.
2. **A wasteful book query.** `Corpus.Book` pulled **every occurrence row**
   for a position into the BEAM (joining moves + games), then reduced in
   Elixir — for a hot position like after 1.d4 Nf6 that is thousands of rows
   per request, all routed through the single serialized `Corpus` GenServer.

## Decision

- **Aggregate the book stats in SQL.** `Corpus.Book.for_key` is now one grouped
  query (a two-stage `DISTINCT` to keep the independent-games convention) that
  returns one row per `(move, result)` — a constant-size payload regardless of
  how many games reached the position. The W/D/B tallies and the "`*`/unrecorded
  counts as a draw" rule move into SQL `FILTER` clauses; the output shape is
  unchanged (verified identical against the previous implementation).
- **Cache `/api/book` responses.** A position's stats are content-addressed by
  the FEN, so responses carry `Cache-Control: private, max-age=300` to
  short-circuit repeat visits. The cache is deliberately short: the tables
  change only on a rebuild, but a long max-age would serve pre-rebuild numbers
  for its duration — discovered when the corpus re-source (ADR-0036) showed a
  day's stale stats. Five minutes balances the cursor's revisits against
  rebuild freshness.
- **Make the states visible.** `ReferencePanel` tracks a `loading / ready /
  failed` status: a pulsing gold dot + "Loading corpus statistics…" header with
  a skeleton bar per row while in flight, and a red "Couldn't load corpus
  statistics." (`role="alert"`) on failure. No silent empty rows.
- **Leave the single-GenServer serialization alone.** It is the replaceability
  seam (ADR-0026); the documented escape is the packed binary index, not a task
  pool. Scale posture is written down in
  [`../corpus-scale-readiness.md`](../corpus-scale-readiness.md).

## Consequences

- The cold-first-call path is cheaper (no thousands-of-rows BEAM round-trip)
  and the states are legible — a slow fetch now announces itself instead of
  looking like "no data".
- The serialization bottleneck and the growth profile are documented with the
  explicit migration trigger (Spike 03 §10.2: > ~5–10M games, painful rebuilds,
  or measured tail latency), so "how does it handle bigger datasets?" has a
  durable answer without building the packed index prematurely.
- A future per-position materialized book table is noted as a revisit option
  if hot positions get slow — the grouped SQL is fast enough today.
