# ADR-0034: Flat room frame and a tabbed timeline

Status: Accepted (2026-08-29)

## Context

ADR-0032 shipped the "Study Hall" IA (rail + board column + dock) but kept the
old visual language for the frame itself: the room rendered inside page padding
(`p-3 gap-3`) with each region — games rail, dock, timeline band — as a rounded,
bordered, shadowed **card** (`panel()`). The v0 wireframe this redesign tracks
(DESIGN.md §1, rule 2) specifies the opposite: a full-bleed frame of square
regions divided by 1px hairlines, so the tool reads as an instrument panel
rather than a stack of floating boxes.

The timeline band (ADR-0024 as amended, ADR-0031) had grown its own layering
machinery: multi-select layer toggles in a "Layers" popover, a single
"spotlight" radio-dot layer when collapsed, a stacked multi-chart view when
expanded — three interaction models for one widget, with three persisted
localStorage keys. Reviewing it against the v0 direction we concluded the
whole layered model was over-built: what the strip needs is one chart at a
time.

## Decision

**Flat frame.** The room frame regions are flush, square, hairline-divided.
`RoomView` drops its page padding/gaps; the rail is a `border-r` region on the
canvas (`void`), the dock a `border-l` region on `panel`, the timeline a
`border-t` region; their corners are square and the panel shadow is gone.
*  Content inside* regions keeps its radii (engine box, game rows, chips) — the
squareness is a property of the frame, not of everything in it. Dialogs,
popovers, and the Home screen keep their card treatment (they are level-3
objects on the frame, not regions of it). `--board-size` is re-derived for the
removed padding and budgets height for the docked timeline strip so the page
never scrolls.

**Tabbed timeline.** The band renders exactly one chart, switched by a tab row
in the strip header (Eval · Material · Activity · Clocks) using the same visual
grammar as the dock tabs (accent underline on the active tab). Gone: the
multi-select layer toggles, the Layers popover, the collapsed-state spotlight
radio dots, and the expanded stacked view. The active layer persists in
`localStorage` (`blunderfest.timelineActiveLayer`). The old
`blunderfest.timelineLayers`, `blunderfest.timelineSpotlight`, and
`blunderfest.timelineExpanded` keys are retired. The analyze action, its
progress fill, and the help popover stay in the header. Charts lose their
dark boxed-card chrome and render directly in the frame.

**Docked bottom strip.** The band is a fixed-height region of the *board
column only*, pinned to the bottom edge of the viewport — the games rail and
the dock both run the full viewport height beside it (the band does not span
under them). It is **not collapsible**: the previous expand/collapse toggle
only toggled between two half-heights and was more confusing than useful, so
it is gone and the strip renders at one height (`h-24` chart). At xl the band
is the second child of a board-column flex wrapper (the board area grows
`flex-1 min-h-0`, the band docks below it); below xl it orders between the
board and the sidebar via the same `display:contents` mechanism. `--board-size`
budgets height for the docked strip so the page never scrolls.

## Consequences

- The room reads as one surface; the board, rail, dock, and timeline share a
  hairline frame. This is the largest single step toward the v0 look.
- The timeline is dramatically simpler: one state (the active layer), one
  rendering path, one persisted choice, one fixed height. The per-layer data
  and chart components are unchanged — only the band's switching/visibility
  logic went.
- Trade-off: only one chart is visible at a time. The v0 wireframe's overlaid
  multi-layer chart was considered and rejected as a poor fit for our four
  differently-scaled series; tabs are the cheaper, clearer model.
- The band is a permanent bottom region of the board column, not a toggleable
  overlay; the board size is stable (no collapse/expand jump). Both sidebars
  run full viewport height, so the frame's verticals read as true columns.
- Both changes are frontend-only; no protocol or backend impact.
