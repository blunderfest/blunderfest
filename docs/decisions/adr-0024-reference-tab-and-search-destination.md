# ADR-0024: Feature docking — adaptive Reference tab; search is a destination

Status: Accepted (2026-08-17)

## Context

The room screen grew by accretion: five viz-box tabs, a four-panel rail, and
four known features still coming — opening book, opening tree (top-X
continuations), endgame table, and very extensive corpus search (ADR-0010).
Without a docking rule, every new feature lands as "one more tab" until the
screen collapses. A brainstorm (2026-08-17) considered a ChessBase-style
rearrangement (see ADR-0025) and settled on grouping by feature *kind*
instead.

The key distinction: the viz box is all **whole-game** views (the story of
the game); the move list and engine are **per-position**. The incoming
book/tree/table are per-position reference; search is a task surface, not
an ambient panel.

## Decision

**Dock by kind:**

- **Per-position reference → a new adaptive "Reference" sidebar tab**
  (Moves | Game info | Reference). Content follows the position: corpus
  continuation rows (move · games · W/D/B%) when the corpus knows the
  position — spike-gated on the durable corpus. Browsing descends
  *locally* (no ops — exploring openings must not spam the shared log);
  "insert as variation" commits via `add_line`, the same gesture engine
  lines use. Visible to all roles and the demo room (read-only data).
  Amended at implementation (2026-08-17): the tab is **always present with
  a text placeholder** when a position has no reference data, not hidden —
  consistent with the viz tabs (Material/Activity) decided the same day;
  tabs that vanish mid-navigation are jumpy.
- **Whole-game views → the viz box, exclusively** (Eval | Moments | Report
  | Material | Activity). If that family ever outgrows the strip:
  consolidate the pure-FEN timelines into one toggleable view, or move the
  box to the full-width band under the board (the design doc's original
  slot). Not now.
- **Search → a destination route (`#/search`)**, solo, full width: FEN
  input, "search this position" deep link carrying the current FEN out of
  the room (with return-to-room), ADR-0010 weight controls, results with
  mini board + decomposition label. Results integrate into a room as a
  game (`set_game`) or a variation (`add_line`). Entry points: app bar,
  library, Reference tab.
- **Engine lines stay fused atop the move list.**
- **Endgame table: deferred.** A corpus can't provide tablebase truth
  (it's computed, not statistics) — when built it docks in the same
  Reference tab, with its own source decision (Syzygy hosting vs external
  API).

## Consequences

- The viz box is bounded: five tabs, and the next features have somewhere
  else to go. Crowding stops being the default failure mode.
- Reference browsing and committing are separate gestures everywhere
  (engine lines, opening tree) — one vocabulary to learn.
- Everything user-visible here is spike-gated (corpus API); the layout
  decision itself costs nothing and prevents wrong docking later.
- Search-as-destination forgoes collaborative in-room search; if that
  turns out to be the marquee interaction, a room mode can grow out of the
  Reference tab without undoing this ADR.
