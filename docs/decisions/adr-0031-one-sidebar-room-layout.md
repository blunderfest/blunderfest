# ADR-0031: One-sidebar room layout, presence as chrome, mobile tabbed sheet

Status: Accepted (2026-08-27)

## Context

The room screen grew by accretion past the point the layout could absorb: four
stacked rail panels (Room/Games/Members/Chat), a board column with six stacked
regions, two sidebar tab groups, and the timeline band (ADR-0024's amendment)
stacked below a board row that already filled the viewport — breaking the
design spec's "no page scroll" invariant at xl and pushing the band below the
fold. Mobile was the desktop DOM in document order: a ~2100px scroll with the
move list 1.5 screens down and chat last. Every feature was visible at all
times, including empty states ("No analysis yet" twice, empty chat). DESIGN-
SYSTEM.md §5.2/§5.3/§8 had drifted from the code (it still specced the removed
Comment panel and Activity feed). With milestone 8 (search) needing homes for
corpus statistics and game lists, "one more panel" was no longer a rule.

Alternatives considered: (A) consolidate the existing 3-region skeleton (merge
rail panels, collapse board chrome) — cheaper, but the skeleton itself was out
of room and would refill; (B) a ChessBase-style docked workspace — already
rejected by ADR-0025. Owner chose the one-sidebar restructure (the shape
lichess/chess.com converged on), with chat behind a tab + unread badge, and
mobile designed first-class rather than derived.

## Decision

**Everything that isn't the board lives in one tabbed column.** Room layout ≥xl:
board column (title row, board + eval bar, one toolbar, collapsed timeline
strip) + one sidebar with tabs **Moves · Review · Reference · Chat · Room**.
Moves = engine box + move list (unchanged). Review absorbs the viz box
(Moments/Report) and Game info. Reference unchanged (ADR-0024). Chat becomes a
tab with an unread badge. Room holds the games list (import/new), member
management, leave, and connection telemetry. The left rail is deleted.

**Presence is chrome, not a panel.** Members render as an avatar strip in the
app bar (Google Docs style); its popover carries follow/presenter/role
actions. The room's primary action — inviting — becomes a gold **Share** (code
+ copy) button in the app bar.

**The timeline band collapses to a strip** under the board: one sparkline-
height scrubbable layer + a Layers popover (the toggle chips move there) + an
expand chevron revealing the full stacked band. Layers with no data and
disabled layers render nothing.

**Mobile is a designed layout, not a stack:** slim header → compact title →
board + eval bar → merged nav/toolbar → timeline strip → one fixed-height
tabbed panel (internal scroll, sticky tab bar). The board never scrolls away —
tapping a move must show its effect. No page-level scroll in a room.

**Anti-clutter contract (amends ADR-0024's docking rule):** no new permanent
panels — a new feature is a sidebar tab, a band layer, a toolbar/overflow
item, a dialog, or a destination; empty states take no space (placeholders
render only inside the active tab; band layers render only when enabled *and*
holding data); one tab idiom everywhere; presence/status is header chrome.
The keyboard-hint row is deleted (the shortcuts dialog and tour cover it).

## Consequences

- The board row fits the viewport again at xl; the page scroll returns only
  where content genuinely overflows.
- ~10 bordered boxes collapse to 2 regions (board column, one sidebar); the
  visible-control count at rest drops sharply (rare actions move to overflow
  menus).
- Milestone 8's docks are unaffected and validated: `#/search` destination via
  app-bar entry, corpus stats in the Reference tab at full sidebar width.
- Cost: chat is no longer ambient — mitigated by the unread badge and a tour
  landmark. The tour's `data-tour` anchors and its copy are re-pointed.
- Cost: substantial DOM churn in `RoomView`/`Analysis*`; the frontend test
  suite (keyed to testids) is updated phase by phase, testids kept stable
  where regions survive.
- DESIGN-SYSTEM.md §5.2/§5.3/§8 is rewritten to match (restoring its "living
  spec" claim); ADR-0024's band/viz-box consequences are amended by this ADR.
- Read-only rooms (`#/r/chess`) render a reduced tab set (no Chat/Room
  management), same as today's gating.
