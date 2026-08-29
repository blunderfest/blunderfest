# ADR-0033: Null moves ("passes") as ordinary tree nodes

Status: Accepted (2026-08-29)

## Context

Teaching and studying need laxity about turn order (e.g. the O'Kelly Sicilian:
"1. e4 c5 -- a6"). The `⚙ Setup` op exists, but it isolates a position; the
teacher wants a *variation* reached by one gesture. This is an analysis
site, not a game site, so the question was where a pass lives in the tree.

## Decision

A pass is a normal child node in the game tree, created by the existing
`move_at_ply` op with `from: null, to: null, san: '--'`. The client fabricates
the pass when a drag/tap fails to match the side-to-move's legal moves but
matches on the flipped position — the two ops (pass, then the dragged move)
go out in socket order. PGN exports emit `'--'`; imports resolve it into the
same null-from/to node against the pass-flipped parent game. No "strict rules"
toggle: the pass cannot fire by accident and gates like every other editor op.

## Consequences

- **Tree model unchanged**: `move_at_ply` payloads were already
  `from/to`-optional, so no protocol or validation migration.
- **Move list parity**: pass consumes one ply and the dragged move lands
  under it, keeping color parity in pairs; `san === '--'` avoids the
  "Setup" glyph and pgn-export FEN-marker path.
- **Corpus route filters passes**: `routeToCurrent` skips `'--'` nodes, so
  the examples dialog resolves --free routes.
- **Ambiguity accepted**: stacked passes flip back and forth; semantic
  quality of the user's PGN is not enforced — a small trade for gesture
  immediacy.
- **Side-to-move chip**: the board carries a mini dot in play mode because
  passes (and setup nodes) make the "whose turn" relation gap, especially
  in variation reviews by viewers.
- **Future work**: none planned. This is neutral to whether names/the
  number-of-pass rule change.
