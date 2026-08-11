# Features

Everything Blunderfest has, plans, or could plausibly grow into. Status marks:

- ✅ **implemented** — shipped and live
- 🚧 **roadmap** — committed direction (see `PROJECT.md` milestones and `docs/decisions/`)
- 💡 **idea** — possible, uncommitted; worth discussing before building

## Analysis board

- ✅ Hand-rolled board (no library): click-to-play legal moves, square highlights for selection/targets/last move, board flip
- ✅ Variation tree with nested variations; conventional move numbering (`2...` only at line starts/interruptions); root variations
- ✅ Per-position comments (collaborative)
- ✅ Keyboard navigation everywhere (`←` `→` `Home` `End`, `f` flip); square-level keyboard play via `:focus-visible` grid navigation
- ✅ Engine eval bar + best-move hint arrow (Stockfish 18 Lite WASM, in-browser, per-viewer)
- ✅ Free-form position setup ("what if the pawn were on h3?") — edit mode moves any piece anywhere; syncs as a setup node in the tree (ADR-0011)
- ✅ Drag-and-drop pieces (palette drag + off-board delete in edit mode); click-click also works
- ✅ Draw arrows/highlights on the board (`set_annotations` op): right-drag / right-click on desktop, long-press on touch/pen, `h`/`a` + `1`-`4` keys; engine hint arrows render as translucent ghosts so they can't be confused with user drawings; `Esc` or the ⌫ button clears a position's drawings
- 💡 NAG glyphs (`!`, `?`, `!?`) — display and entry
- 💡 Engine lines panel (MultiPV top-N lines, click to insert as a variation)
- 💡 Blunder flags on moves (auto `?`/`??` from eval swings) — in ADR-0009's original scope
- 💡 Opening name/ECO display for the current position
- 💡 Tablebase (Syzygy) probe for ≤7-piece positions
- 💡 Keyboard move input (type SAN/uci) — complements the square grid for keyboard/AT users
- 💡 Board themes / piece sets

## Collaboration (rooms)

- ✅ Rooms with 5-char unambiguous codes; explicit creation (`POST /api/rooms`); deep links `#/r/<code>`
- ✅ Real-time sync via op log (replay on join, single echo path)
- ✅ Presence (who's here, names) and roles: owner / collaborator / viewer, server-enforced edit rights, promote/demote
- ✅ Presenter/follow mode: cursor + game-selection sync, break-away/re-follow
- ✅ Multiple games per room: import, new blank game, switch
- ✅ Activity feed (who did what, minus cursor noise)
- ✅ Room code in the app header (copy to share; joiners land as viewers)
- ✅ Read-only demo room at `#/r/chess` (annotated Opera Game), seeded on demand — linked from the home page (ADR-0014)
- ✅ Sidebar tab shell (Analysis now; Explorer + Search get a home when they land)
- 💡 Private rooms with owner-approved joins (the `:pending` approval seam already exists — ADR-0006)
- 💡 Text chat
- 💡 Per-member cursor/arrow colors (see who points where)
- 💡 Share links with preset roles (view-only link vs editor link)
- 💡 Move voting/polls ("what's the best move here?" — members vote, owner reveals)
- 💡 Comment threads/replies and reactions
- 💡 Spectator counter

## Engine

- ✅ Browser Stockfish (lite single-threaded WASM) — instant eval + hint, zero server cost
- ✅ Floating eval badge at the bar's split point; result display on terminal positions
- 🚧 Server-side UCI worker pool: whole-game analysis jobs, per-ply evals, eval-curve chart (ADR-0009; consistent truth for all room members)
  - Visual targets from the design explorations (`design/analysis1.html`): "Game Flow" eval curve with blunder/brilliant markers, per-move eval column in the move list, `!!`/`??` row treatments, inline "Engine Top Line" box
- 💡 Cloud eval cache (share computed evals across users/rooms)
- 💡 "Learn from this game" report: mistakes, turning points, best-move diffs
- 💡 3D board (Three.js) — cool but heavy; the cheap version is a 3D-styled piece sprite theme on the 2D board

## Games & library

- ✅ PGN paste import → variation tree
- ✅ Lichess URL import
- ✅ New blank game for free play/analysis
- ✅ PGN export (annotated: variations, comments, NAGs; setup analysis exports as extra games with SetUp/FEN headers)
- 🚧 Room/game claiming and a per-profile game library (the reason to have an account at all)
- 💡 Chess.com game URL import
- 💡 Bulk PGN import (multi-game files)
- 💡 FEN share links / position-only URLs
- 💡 Folders/tags for games; repertoire storage
- 💡 Board-as-image export (PNG of a position)

## Search (marquee — ADR-0010)

- 🚧 Position search: exact *and* similar (shift/substitute/add/remove/color flip), user-configurable weights, weight-agnostic index
- 🚧 Result labels decomposed from the winning transformation ("pawn h3→h2", "colors reversed")
- 🚧 Bulk corpus import (e.g. Millionbase) — a search feature is meaningless on a tiny corpus
- 💡 Master-game reference panel (what was played in this position historically)
- 💡 Search by player/event/opening across the corpus

## Identity

- ✅ Anonymous-first profiles: fun generated name, device secret in localStorage, salted hash server-side, zero stored PII
- 🚧 Optional sign-in (magic link / external provider) stored as keyed hashes — cross-device identity without PII
- 💡 Profile settings (rename, preferred piece set/theme)

## Accessibility & i18n

- ✅ Keyboard-playable board, aria roles/labels, live regions, skip link, axe scans in tests
- ✅ i18n scaffold (react-i18next, English source locale; server returns error codes, never prose)
- 💡 More locales
- 💡 High-contrast board theme

## Operations

- ✅ Single-artifact Phoenix release serving API + sockets + SPA; Fly.io scale-to-zero
- ✅ No-cache shell so deploys take effect on refresh
- 🚧 REVIEW.md items: secrets out of `fly.toml`, server-side op validation, room/op caps, re-enable CI
- 💡 Persistent storage when a feature needs durability (game library, corpus) — requires revisiting ADR-0001 explicitly
- 💡 Rate limiting on room/profile creation
