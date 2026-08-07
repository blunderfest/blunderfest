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
- 💡 Draw arrows/highlights on the board (op types `add_arrow`/`add_highlight` already exist in the protocol; UI missing)
- 💡 Drag-and-drop pieces (currently click-click)
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
- ✅ Room code in the app header for the owner (copy to share)
- 💡 Private rooms with owner-approved joins (the `:pending` approval seam already exists — ADR-0006)
- 💡 Text chat
- 💡 Per-member cursor/arrow colors (see who points where)
- 💡 Share links with preset roles (view-only link vs editor link)
- 💡 Move voting/polls ("what's the best move here?" — members vote, owner reveals)
- 💡 Comment threads/replies and reactions
- 💡 Spectator counter

## Engine

- ✅ Browser Stockfish (lite single-threaded WASM) — instant eval + hint, zero server cost
- 🚧 Server-side UCI worker pool: whole-game analysis jobs, per-ply evals, eval-curve chart (ADR-0009; consistent truth for all room members)
- 💡 Cloud eval cache (share computed evals across users/rooms)
- 💡 "Learn from this game" report: mistakes, turning points, best-move diffs

## Games & library

- ✅ PGN paste import → variation tree
- ✅ Lichess URL import
- ✅ New blank game for free play/analysis
- 🚧 PGN export (annotated: variations, comments, NAGs)
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
