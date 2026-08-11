# ADR-0019: echecs dependency posture — stay; fork/vendor if it stalls

Status: Accepted (2026-08-11)

## Context

The chess core depends on `echecs ~> 0.1.4`, a 0.1 library by a single
author (two releases, near-zero activity). The 2026-08-06 review flagged it
as the highest correctness risk: a compile-time magic-cache hack, and gaps
we work around (its `Echecs.PGN` is a test helper, so we hand-roll parsing).

A proper assessment (2026-08-11) found the risk contained rather than
acute: echecs is used only in `pgn.ex` (server-side import parsing — ADR-
0018 keeps chess authority on the server); everything interactive runs on
chess.js in the browser. Failures on this path are loud (a 422 at import),
never silent corruption. Upstream validates movegen against Lichess-DB
replay, and our parser fixtures cover castling, en passant, promotions, and
disambiguation. The one legality gap in echecs's SAN path (castling via
pseudo-legal moves) is the case we bypass; its standard SAN path verifies
legality. GPL-3.0 licensing is compatible (our LICENSE is GPL-3.0).

## Decision

Keep the dependency. The compile-time cache generation stays automated
(`scripts/ensure_echecs_magic_cache.exs`, and the same step in the
Dockerfile).

If the library breaks on a future Elixir/OTP or disappears from hex —
abandonment is the real risk — **fork/vendor it into the repo** (~4k
lines, license-compatible). Do not replace it with client-side parsing
(ADR-0018); no mature Elixir alternative exists.

## Consequences

- The dependency is intentional infrastructure, revisited only if it
  breaks.
- If upstream activity resumes meaningfully, re-evaluate dropping the
  workarounds (magic cache, our PGN layer) in favor of upstream fixes.
