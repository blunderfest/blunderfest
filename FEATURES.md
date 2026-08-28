# Features

Everything Blunderfest has, plans, or could plausibly grow into. Status marks:

- ✅ **implemented** — shipped and live
- 🚧 **roadmap** — committed direction (see `PROJECT.md` milestones and `docs/decisions/`)
- 💡 **idea** — possible, uncommitted; worth discussing before building

## Analysis board

- ✅ Hand-rolled board (no library): click-to-play legal moves, square highlights for selection/targets/last move, board flip
- ✅ cburnett SVG piece set (GPLv2+, crisp at any size, identical on every platform)
- ✅ Variation tree with nested variations rendered as indented blocks at every level (no inline parens); conventional move numbering (`2...` only at line starts/interruptions); root variations
- ✅ Line-path breadcrumb inside variations: the path from the branch point above the move list, one click back to the mainline
- ✅ Per-position comments (collaborative)
- ✅ Keyboard navigation everywhere (`←` `→` `Home` `End`, `f` flip); square-level keyboard play via `:focus-visible` grid navigation
- ✅ Engine eval bar + best-move hint arrow (Stockfish 18 Lite WASM, in-browser, per-viewer)
- ✅ Free-form position setup ("what if the pawn were on h3?") — edit mode moves any piece anywhere; syncs as a setup node in the tree (ADR-0011)
- ✅ Drag-and-drop pieces (palette drag + off-board delete in edit mode); click-click also works
- ✅ Draw arrows/highlights on the board (`set_annotations` op): right-drag / right-click on desktop, long-press on touch/pen, `h`/`a` + `1`-`4` keys; engine hint arrows render as translucent ghosts so they can't be confused with user drawings; `Esc` or the ⌫ button clears a position's drawings
- ✅ NAG glyphs (`!`, `?`, `!?`, `?!`, `!!`, `??`) — shown in the move list (they win over analysis marks), set from the annotation popup (the `c` key)
- ✅ Blunder flags *while dragging* (the milestone-4 engine scope): a dedicated second engine instance live-evals the dragged candidate, the ??/?/?! badge rides the move list's own thresholds
- 💡 Tablebase (Syzygy) probe for ≤7-piece positions — deferred (ADR-0024); docks in the Reference tab when built, source TBD (a corpus can't provide it)
- 💡 Keyboard move input (type SAN/uci) — complements the square grid for keyboard/AT users
- 💡 Board themes / piece sets

## Collaboration (rooms)

- ✅ Rooms with 5-char unambiguous codes; explicit creation (`POST /api/rooms`); deep links `#/r/<code>`
- ✅ Real-time sync via op log (replay on join, single echo path)
- ✅ Presence (who's here, names) and roles: owner / collaborator / viewer, server-enforced edit rights, promote/demote — rendered as the app-bar avatar strip with a management popover (ADR-0031); a member's extra tabs no longer evict them (meta-level presence sync via `phx_ref`)
- ✅ Room chat: messages ride the op log (history replays on join); owners/collaborators write, viewers read along, and the owner can delete messages (ADR-0023); a sidebar tab with an unread badge (ADR-0031)
- ✅ Presenter/follow mode: cursor + game-selection sync, break-away/re-follow; the owner can hand the mic to any member (ADR-0021)
- ✅ Multiple games per room: import, new blank game, switch (the Room tab)
- ✅ Share the room code from the app bar (mono chip, click to copy; the deep link lives in the address bar); the games rail (switch/import/new) and a header region chip (server + room region + RTT) are chrome; leaving the room is the logo (ADR-0032)
- ✅ Read-only demo room at `#/r/chess` (annotated Opera Game), seeded on demand — linked from the home page (ADR-0014); its badge sits on the header code chip
- ✅ The Study Hall room layout (ADR-0032): games rail (chrome) + board column + one tabbed dock (Moves · Review · Chat); engine box pinned in Moves atop the opening-book reference block; tour landmarks re-pointed
- 💡 Private rooms with owner-approved joins (the `:pending` approval seam already exists — ADR-0006)
- 💡 Per-member cursor/arrow colors (see who points where)
- 💡 Share links with preset roles (view-only link vs editor link)
- 💡 Move voting/polls ("what's the best move here?" — members vote, owner reveals)
- 💡 Comment threads/replies and reactions
- 💡 Spectator counter

## Engine

- ✅ Browser Stockfish (lite single-threaded WASM) — instant eval + hint, zero server cost
- ✅ Floating eval badge at the bar's split point; result display on terminal positions
- ✅ Opening classification (ECO + name under the players, follows the viewed line incl. variations; lichess book, position-keyed)
- ✅ Server-side UCI worker pool (ADR-0009): whole-game analysis on demand, per-move evals + quality marks in the move list, results synced to all members as a `set_analysis` op; **Re-analyze** when the mainline outgrows the job, and **Analyze line** for the viewed variation — node-keyed evals merge per node, variation rows get their own marks
- ✅ Whole-game visualization (ADR-0024 as amended; ADR-0031): the **timeline band** under the board — a collapsed, scrubbable strip by default (fixed-order layer dots switch the charted layer, Layers popover for on/off, expand chevron; all persisted per viewer); expanded = Eval | Material | Activity | Clocks stacked layers on one shared move axis; eval chart with blunder dots, cp/win% toggle, opening book-exit marker, opening/endgame phase shading, capture/exchange marks; material and piece-activity timelines (pure FEN data, no engine); thinking-time bars from `[%clk]` data (extracted at parse time; Lichess imports fetch clocks). The Review tab keeps the list views: Moments (mini boards of the biggest swings), Report, and Game info
- ✅ Engine lines panel (MultiPV top-N, configurable 1–5, persisted); click a line to insert it as a variation (`add_line` op, atomic)
- 💡 Cloud eval cache (share computed evals across users/rooms)
- ✅ "Learn from this game" report (viz-box Report tab): per-side accuracy (lichess's per-move win-share-loss curve), blunder/mistake/inaccuracy counts, every marked move with the eval swing + the engine's best alternative, result + opening header
- 💡 3D board (Three.js) — cool but heavy; the cheap version is a 3D-styled piece sprite theme on the 2D board

## Games & library

- ✅ PGN paste import → variation tree
- ✅ Lichess URL import
- ✅ New blank game for free play/analysis
- ✅ PGN export (annotated: variations, comments, NAGs; setup analysis exports as extra games with SetUp/FEN headers)
- ✅ Per-profile game library (ADR-0020): save a room game, reopen it in a fresh room — session-scoped until the storage decision
- 💡 Sign-in (magic links) + durable accounts — the claiming half of the library; gated on the ADR-0001 storage decision
- ✅ Chess.com import: browse a player's monthly archive (official public API — their terms forbid callback endpoints/scraping, so no per-URL import), multi-select games, inline PGNs
- ✅ Bulk import: multi-game PGNs (per-game failures reported, good games import), multiple Lichess URLs, and PGN+URL mixtures — the import box splits line-wise; single-game-URL import unchanged
- ✅ Guided tour of the room UI (help-menu entry; hand-rolled spotlight)
- 💡 FEN share links / position-only URLs
- 💡 Folders/tags for games; repertoire storage
- 💡 Board-as-image export (PNG of a position)

## Search (marquee — ADR-0010)

- 🚧 Position search: exact *and* similar (shift/substitute/add/remove/color flip), user-configurable weights, weight-agnostic index — its own `#/search` destination, results open into rooms as a game or variation (ADR-0024)
- 🚧 Result labels decomposed from the winning transformation ("pawn h3→h2", "colors reversed")
- 🚧 Bulk corpus import (e.g. Millionbase) — a search feature is meaningless on a tiny corpus
- ✅ Reference tab (ADR-0024): per-position continuation rows that play the move on click (broadcast, like the board) and preview it as a ghost arrow on hover; placeholder when off-book — v0 runs on the static opening book (named continuations, no statistics)
- 🚧 Reference tab corpus upgrade: games · W/D/B% statistics per continuation (spike-gated)
- 💡 Reference game lists (who played this position, best-rated games) — extends the Reference tab
- 💡 Search by player/event/opening across the corpus

## Identity

- ✅ Anonymous-first profiles: fun generated name, device secret in localStorage, salted hash server-side, zero stored PII
- ✅ Lichess-linked accounts (ADR-0022): OAuth2+PKCE, link as recovery key + data source (never a persona), one-time exchange code signs a new device in — in-memory until the storage decision
- ✅ Lichess study import: every chapter imports as a game, from the import dialog's "My Lichess studies" tab
- ✅ Lichess recent-games import: multi-select your recent games and import them in bulk ("My games" tab)
- 🚧 Optional sign-in (magic link / external provider) stored as keyed hashes — cross-device identity without PII (the lichess account is the first external account; more can follow)
- 💡 Profile settings (rename, preferred piece set/theme)

## Accessibility & i18n

- ✅ Keyboard-playable board, aria roles/labels, live regions, skip link, axe scans in tests
- ✅ i18n scaffold (react-i18next, English source locale; server returns error codes, never prose)
- 💡 More locales
- 💡 High-contrast board theme

## Operations

- ✅ Single-artifact Phoenix release serving API + sockets + SPA; Fly.io scale-to-zero
- ✅ No-cache shell so deploys take effect on refresh
- ✅ Secrets in `fly secrets` (never the repo), server-side op validation (`Blunderfest.Ops`), room/op caps, room-creation rate limit per client IP (ADR-0017); no CI — checks run locally (`mix precommit`, pnpm)
- 💡 Persistent storage when a feature needs durability (game library, corpus) — decided in Spike 03 (Postgres for app data + canonical corpus, derived index behind a `Corpus` boundary); reintroducing Ecto amends ADR-0001 and awaits the implementation milestone
- 💡 Rate limiting on profile creation (room creation is already covered)
