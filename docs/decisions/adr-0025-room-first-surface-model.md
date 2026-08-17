# ADR-0025: Room-first — the library supports, never becomes the home

Status: Accepted (2026-08-17)

## Context

The product ambition is "a ChessBase competitor, but online and
collaborative". ChessBase's desktop UI is database-first: a games-grid
desktop, games as documents, and dockable panes (book tree, reference,
engine, tablebase) around the board, plus a ribbon. Should Blunderfest
rearrange toward that — a workspace home with rooms as documents?

Two facts weigh in. ChessBase's own web apps (database.chessbase.com,
MyGames) abandoned the docking/ribbon model entirely — simplified
single-page layouts. And the collaborative room is Blunderfest's
differentiator; burying it under a corpus browser trades the
differentiator for the commodity.

## Decision

**Room-first.** A user opening Blunderfest lands in / goes to a room; the
library *backs* the room (load games and analyses from it) but never
becomes the landing surface — this holds even with a durable library in
place (user, 2026-08-17). The room layout follows ADR-0024; ChessBase's
*information architecture* worth stealing (position-following reference,
a real games grid) is adopted, its *interaction model* (floating panes,
ribbons, MDI) is explicitly not.

When the library becomes durable (ADR-0001 revisit), it may grow
workspace affordances — sortable/filterable games grid, search integrated
into it — as a support surface. A database-first home is rejected
indefinitely, not just deferred.

## Consequences

- The home page stays a landing/entry page; the library screen evolves
  independently of the room.
- Nothing in the room layout changes when the library grows.
- The "workspace home" idea (Plan B) is parked with its rationale here;
  if the product's center of gravity ever genuinely shifts, this is the
  ADR to supersede.
