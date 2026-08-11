# ADR-0018: The server keeps first-class chess understanding

Status: Accepted (2026-08-11)

## Context

While assessing the echecs dependency (ADR-0019) we floated moving PGN
parsing to the client (chess.js is already shipped for interactivity) and
dropping server-side chess entirely. Today the server stores room ops
opaquely — it validates their *shape* but not their chess content, and move
legality is enforced client-side.

That direction was rejected: it would make the server a relay that shuttles
messages it doesn't understand, just as the roadmap needs the opposite —
milestone 7 (server engine pool, whole-game reports) and milestone 8
(position extraction, similarity search, ADR-0010) all require the server
to interpret games.

## Decision

The server keeps — and grows — first-class chess understanding:

- PGN parsing stays server-side (the import endpoints are the canonical
  way games enter the system).
- When milestones 7–8 need it, the server will materialize trees/positions
  from op logs; op payloads already carry full move data (SAN, squares,
  FEN) with that in mind.
- chess.js in the browser remains the *interactivity* layer (drag
  legality, instant hints), never the system of record for game meaning.
- Consequently the echecs dependency (or a vendored successor, ADR-0019)
  is intentional infrastructure, not a stopgap.

## Consequences

- Server-side chess code is expected to grow (op→tree materialization,
  engine reports, position extraction) rather than shrink.
- Client-side validation is a UX convenience; server-side understanding is
  the authority when they disagree (e.g. a crafted client op is inert — it
  is stored, not believed).
- Note for milestone 7: the day the server materializes trees from op logs
  it starts *believing* op content (reports, indexes) rather than merely
  storing it — op validation must then tighten from shape-only toward
  chess semantics.
- Dropping echecs is off the table unless a successor provides the same
  server-side competence.
