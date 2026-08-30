# ADR-0027: Historical-evidence pipeline — evidence over scores, PG as the v0 index

Status: Accepted (2026-08-25)

## Context

The historical-evidence vertical slice (Spikes 01–06) needed a set of
pipeline decisions: where occurrence data lives for the slice, which
family settings ship as the general default, how the plan skeleton is
used, and how "sameness" is exposed without fusing signals into a score.

## Decision

- **Postgres is the v0 index layer.** Occurrences, positions (with the
  pawn-skeleton bucket hash), games and moves live in the corpus schema
  behind `Blunderfest.Corpus.Occurrences` (COPY-loaded, UNLOGGED,
  rebuildable from the extraction artifacts). The in-memory ETS index of
  Spike 02 is not ported: it would not fit the 1 GB prod VM, and PG
  measured fine (lookups ~1 ms). The packed binary index stays the
  designated successor behind the same boundary.
- **The pawn bucket hash is 63-bit.** The full 128-bit BLAKE2b truncates
  to 63 bits so it fits a signed `bigint`; a rare bucket collision merely
  merges two skeleton buckets and cannot produce a wrong candidate. The
  position key itself stays 128-bit. One canonical function
  (`Features.pawn_hash/1`) serves the store and the retrieval code.
- **Families: one general setting.** Single-linkage clustering over the
  exact occurrences' continuations at window 6, multiset Jaccard,
  threshold 0.5 (Spike 04's F1 setting). Per-reference tuning (A2's
  LCS@0.6) is deliberately deferred.
- **The plan skeleton is a membership/annotation layer, never a
  clustering representation** (Spike 06): per-side action-set similarity
  at threshold 0.5, scored against the baseline families. A tempo twin
  joins a family on the side that executed the plan. `:skeleton_phase` is
  not implemented (Spike 06 dropped it).
- **Evidence, not scores** (brief §16): the result exposes typed
  differences, routes, family memberships and occurrence/independent-game
  counts. `same_game_only` marks candidates that are repetitions within
  one game (brief §13); `singleton`/`singleton_family` mark one-game
  evidence (the Spike 05 failure).
- **The API is facts-only** (brief §17): the backend returns structured
  fields (`shared_plies`, `extra_white`, …); the client owns all copy and
  presentation. The application-facing service
  (`Blunderfest.HistoricalEvidence`) is the only way in; corpus internals
  stay behind `Blunderfest.Corpus`.

## Consequences

- The full pipeline answers "what does Blunderfest know about historical
  examples of this position?" end-to-end: candidates, comparisons, routes,
  continuations, families, per-side membership, counts and flags.
- Measured on the 100k corpus: 170–354 ms per request — comfortably
  interactive; the packed index is not needed yet. (The opening-book read
  path was later tightened — SQL-side aggregation + cache headers — and the
  scale posture is documented; see ADR-0035 and
  `docs/corpus-scale-readiness.md`.)
- The general family setting may mis-cluster positions that need
  per-reference tuning; the known cases (F1, A2) are pinned by regression
  tests built on the research fixture corpus.
- Candidate caps (40 structural, 2000 bucket keys) are explicit and
  visible, not hidden in a ranking.
