# ADR-0032: Games rail as chrome and the "Study Hall" redesign IA

Status: Accepted (2026-08-28)

## Context

ADR-0031 put everything that isn't the board in one tabbed column and made
the left rail disappear. Living with it surfaced a real defect: the Room tab
buried the games cluster — switching/importing games, and the room's
connection telemetry (region/lag) — behind a tab click. In multi-game rooms
(the marquee historical-evidence workflow adds games), nothing chrome-visible
says "3 games here" or lets you switch; the redesign's doctrine "your UI
buries the room" was confirmed by use, and the IA accepted one more
front-of-canvas region to fix it.

The direction wasn't invented on spec: an external design iteration (the v0
wireframe — its frozen spec lives at `design/DESIGN.md`, local-only source
under `design/v0/extracted/`, critique history in
`design/DESIGN-PROMPT.md`'s "repeated critique" section) validated a
two-chrome-regions IA through several review passes against the prompt's
hard requirement #4 ("games are chrome, not a tab"). The spec's visual
tokens (colors, elevation, typography) ride along as the measured migration
target; the IA below is what this ADR decides.

## Decision

**Games get their own chrome region back — a dedicated games rail, not the
old all-purpose rail.** Left side, 260–280px on desktop, collapses to a
horizontal strip on mobile: a fixed rail header ("Boards · N" + a +/"Add
game" icon) over a vertically scrollable list of compact text rows —
title, eval badge, meta (opening · move · watching avatars) — so the rail
itself scrolls at scale (`min-h-0` + `overflow-y-auto`). Position-setup
games carry a "position" chip, never an eval badge or fake thumbnail.

**The header owns connection telemetry.** A compact region chip
(`● AMS↔CHI 96ms`, tooltip: "Connected to …; room stored in …; …ms RTT")
replaces the Room tab's connection readout; it degrades on service failure.
The no-op engine "Ready" dot in the header goes away — engine readiness
lives in the engine box (ADR-0031's own enforcement).

**The Room tab is gone entirely.** The app bar carries the room code as a
mono chip (click to copy the code; read-only rooms wear the demo badge
there), the header region chip owns connection telemetry, presence keeps
its popover (ADR-0031's chrome model survives — this ADR amends the tab
structure, not the presence model), and leaving is the logo (it navigates
home and the route change unmounts the room). The dock's set is Moves ·
Review · Chat; the Share button (deep-link copy) is superseded — the
address bar holds the link, the chip copies the code.

**The dock's tab set is Moves · Review · Chat.** The Reference tab
(ADR-0024) folds into Moves as the opening-book block (per-continuation
rows, corpus statistics post-spike) — the v0 wireframe validated that
per-position reference sits naturally between the engine box and the move
list; ADR-0024's "adaptive Reference tab" is amended to "a block inside
Moves". Review keeps Moments | Report | Game info.

**A consistent engine-box home**: pinned atop the Moves tab, both docs'
"Outside tab system" and "Inside Moves" alternatives resolved to the latter.
Timeline, presence-as-chrome, anti-clutter docking and the designed-mobile
rules from ADR-0031 all survive; this ADR supersedes ADR-0031's
region-structure paragraphs ("one sidebar", "the left rail is deleted"),
the Room tab itself, and the Share button.

## Consequences

- Multi-game rooms are legible chrome again: game count, eval, watchers,
  switch/import at zero clicks; two chrome regions flank the board column
  (games rail left, dock right) instead of ADR-0031's one dock. The
  redesigned IA is now the acceptance contract: `design/DESIGN.md`.
- The header code chip removes the Room tab's only remaining content; the
  tab itself is deleted — the dock is Moves · Review · Chat, and the empty
  room's dock is a bare chat panel (no tab strip for one panel).
- Risk check: rail scrollability at scale (~15+ games) is the named
  acceptance test — that failure was the original critique; the rail
  must scroll its own list, not clip.
- Token/visual refresh: implementation may adopt DESIGN.md's target tokens
  (`--color-bf-*`, the rail/dock widths, presence-hue classes, NAG glyph
  map) piecemeal; a partial IA-without-tokens implementation is acceptable,
  a tokens-only pass is not. (The current implementation keeps the existing
  token names and adopts the IA.)
- Rollout marked "implementation pending" per the ADR rules: the redesign
  doc and index were updated when the decision was made; `assets/`
  implementation follows and flips the status.
- DESIGN-SYSTEM.md §5.2/§5.3/§8 is rewritten to match; the embedded
  diagrams are redrawn on the rail–board–dock frame.
