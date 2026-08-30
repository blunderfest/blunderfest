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
  position — spike-gated on the durable corpus. Visible to all roles and
  the demo room (read-only data). Amended at implementation (2026-08-17):
  the tab is **always present with a text placeholder** when a position
  has no reference data, not hidden — consistent with the viz tabs
  (Material/Activity) decided the same day; tabs that vanish
  mid-navigation are jumpy.
- **Rows play the move (revised same-day after v0 shipped).** The original
  text had browsing descend *locally* with an "insert as variation"
  commit. In practice: hovering a row previews the move as a translucent
  ghost arrow on the board (the engine-hint visual — local, never
  broadcast), and **clicking a row plays the move as a real broadcast
  op**. Broadcast won because the collaborative case is the point (a
  presenter walking the book must be visible to the room), the tree is
  the canvas (no takeback exists anywhere — board play is equally
  permanent), and it deleted the whole local-descent/insert machinery:
  the panel's re-anchor-on-cursor-move performs the descent for free.
  Viewers preview only. Engine lines keep their bulk PV insert — a
  different gesture (a whole line in one op).
- **Whole-game views → the timeline band under the board (amended
  2026-08-24).** Originally these owned the viz box exclusively (Eval |
  Moments | Report | Material | Activity), with "consolidate or move to
  the full-width band under the board" as the named escape hatch once the
  strip outgrew five tabs. That hatch is now the layout: the growing
  whole-game family (driven by `docs/visualization_ideas.md` §16 — one
  synchronized timeline beats independent charts) lives as **stacked,
  toggleable layers in a full-width band** below the board+sidebar row at
  xl (directly under the board below xl), all sharing one move axis
  (`spanPly` = the mainline tip) and the scrub-to-ply gesture — Eval,
  Material, Activity first, with clock-time and further timelines joining
  as layers, never as sidebar tabs. The viz box keeps the **list-like**
  views: Moments | Report (always present, placeholders until an
  analysis). A third desktop column for these was considered and
  rejected: timelines are wide-and-short (wrong aspect ratio for a
  ~300px column), the band is pre-specced by the design system, a 2xl-only
  column would hide the feature from most laptops, and per-position
  content already has its docks (Reference tab, board overlays).
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

- The viz box is bounded — and since the 2026-08-24 amendment, bounded to
  the list views (Moments | Report). Whole-game timelines dock as band
  layers; crowding stops being the default failure mode.
- Reference browsing and committing are separate gestures everywhere
  (engine lines, opening tree) — one vocabulary to learn.
- Everything user-visible here is spike-gated (corpus API); the layout
  decision itself costs nothing and prevents wrong docking later.
- Search-as-destination forgoes collaborative in-room search; if that
  turns out to be the marquee interaction, a room mode can grow out of
  the Reference tab without undoing this ADR.
- The band's layers align by sharing one x-axis and one scrub target;
  layer visibility is a per-viewer localStorage preference (like the eval
  cp/win% scale), never a broadcast op.
- **Amended by ADR-0031 (2026-08-27):** the docking rule here is extended
  into a full anti-clutter contract (no new permanent panels; a feature is a
  sidebar tab, band layer, toolbar/overflow item, dialog, or destination).
  The band becomes a collapsed strip under the board, the viz box folds into
  the Review tab, and the Reference tab docks in the one-sidebar column
  (Moves · Review · Reference · Chat · Room).
- **Amended by ADR-0032 (2026-08-28):** the Reference tab folds into the
  Moves tab as the opening-book block (per-continuation rows, corpus
  statistics when the corpus lands); the dock's set is Moves · Review ·
  Chat · Room. Per-position reference docking itself is unchanged.
- **Corpus statistics landed (2026-08-30):** the book rows now carry the
  corpus data this ADR spike-gated. `Blunderfest.Corpus.Book` computes the
  per-move independent-game counts + W/D/B outcomes behind the corpus
  boundary (served at `GET /api/book?fen=…`); the ReferencePanel merges
  them into the named book rows (count + W/D/B rate bar; rows without
  corpus data stay plain). The endgame/tablebase source decision from the
  "Endgame table: deferred" line above is still open — the panel currently
  only names endgame territory (the reserved hook), no tablebase truth.
- **Phase model + one-ply transpositions (2026-08-30):** the panel's
  resolution order is now explicit — tablebase-eligible (a label; no
  source) → in-book (ReferencePanel + bars) → one-ply transposition back
  into book → likely-endgame → cached evidence → find-CTA. The phase model
  (`phaseOf`: material/24, pawns included; `tablebaseEligible` ≤ 7 pieces;
  `likelyEndgame` ≤ 0.5) is unified with the eval chart's endgame shading
  (`endgameStart`). Transpositions are local (the client holds the book) +
  one batched `POST /api/book/counts` for the candidates' independent-game
  support; the rows are interactive (ghost preview + click-to-play, like
  the book rows).
- **Corrections the same day (2026-08-30):** the start position counts as
  in the book by definition — the corpus has no entry for it, so a fresh
  board otherwise read as "outside the book" and its 20 first moves looked
  like transpositions. The cached-evidence summary counts the candidates
  the View dialog will list (with the analyzed game filtered out), not the
  reference position's exact-match games — an off-book position has 0
  exact games but can still surface many similar examples, so the summary
  and the dialog must agree. The find-examples dialog's two-pane row is
  fixed-height (`h-[min(60dvh,34rem)]`), so expanding a card's Comparison
  details scrolls the pane instead of resizing the modal (the carousel's
  fixed-slide-height guarantee, restored).
