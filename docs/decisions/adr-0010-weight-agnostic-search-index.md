# ADR-0010: Search indexes weight-agnostic piece maps so user-configurable weights never require reindexing

Status: Accepted — implementation pending

## Context

Position search (exact *and* similar) is a marquee feature, with
user-configurable similarity weights from day one. If weights were baked into
the index (e.g. precomputed index keys per weight combination), changing a
weight would require re-running the whole corpus — unacceptable once the
corpus is large.

## Decision

- The `positions` index stores **full piece maps** (per-color square + type
  sets) plus cheap **prefilter buckets** (pawn structure, material, piece
  count), all indexed.
- Prefilters narrow candidates; real ranking is computed live against the
  query using the user's current weights.
- **Changing weights never requires re-running the corpus.**
- The similarity metric is a minimum-cost transformation between piece
  multisets (match / shift / substitute / add / remove, optional color flip,
  optional pawn-structure-only scope). With ≤32 pieces and tight prefilters a
  greedy assignment + refinement is exact enough — and the winning assignment
  decomposes into human-readable result labels ("pawn h3→h2", "rook→bishop",
  "colors reversed"), making the explanation a free byproduct.
- Ships with golden-fixture tests (hand-computed distances) and property tests
  (e.g. symmetry under color flip).

## Consequences

- Search results depend on per-request weights; ranking is CPU work per query
  rather than a lookup — acceptable while prefilters keep the candidate set
  tiny.
- The corpus is a background import job: importing a game extracts one
  `positions` row per ply; bulk PGN archive import is in scope for v1 (search
  is meaningless on a tiny corpus).
- The metric's cost model and prefilter buckets are the core intellectual
  property of the feature — they deserve golden fixtures before any UI exists.
