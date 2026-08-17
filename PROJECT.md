# Blunderfest — Project Overview & Roadmap

Collaborative chess analysis: import games, analyze solo or with other people in real
time, and search a growing corpus of positions (exact and *similar*).

This document is the roadmap and entry point. Deep-dives live in [`docs/`](docs/README.md):
[architecture](docs/architecture.md), [operations](docs/operations.md), and the
[ADR set](docs/decisions/README.md) record the *why* behind every significant decision.
Future sessions: read this file, then `docs/architecture.md`, keep both current.
The feature inventory lives in [`FEATURES.md`](FEATURES.md).

## Hard constraints

- Backend: **Elixir + Phoenix**, real-time via **Phoenix Channels**, plain **JSON API**.
- **The backend contains no UI** — JSON API + sockets only; the compiled React bundle
  is served by a catch-all route (ADR-0002).
- Frontend: **React 19** (Vite build, bundled by Phoenix for a single-app deploy).
- **No database** — in-memory GenServer state rebuilt on boot (ADR-0001). Reintroducing
  one needs explicit approval.
- No hard release deadline; hobby project, but built **as if it will be shipped** —
  releasable at every milestone.

## Core principles

1. **Anonymous-first, no stored PII.** Full access without an account; profiles are a
   server-generated fun name + device secret, only salted hashes stored (ADR-0004).
2. **Open collaboration.** Anyone with a room link joins; roles (owner/collaborator/
   viewer) gate editing.
3. **Analysis is unstructured.** The board is a canvas: moves, variations, arrows,
   comments. Hand-rolled board component — no board library.
4. **Search is a marquee feature.** Same *and* similar positions with
   **user-configurable similarity weights** from day one (ADR-0010).
5. **Correctness first.** Similarity ships with golden-fixture tests.

## Product model

- **Games** — imported PGNs (paste, or Lichess link). Any game can be analyzed by anyone.
- **Rooms** — a shared analysis session per 5-char code, created explicitly via
  `POST /api/rooms` (ADR-0006); join by code or `#/r/<code>` deep link.
- **Profiles** — automatic anonymous identity (fun name + device secret, ADR-0004).
  Signing in (magic links / external providers, keyed hashes only) is a future bridge
  to cross-device identity.
- **Game library** — per-profile collection of owned/claimed games; a first-class
  early feature (the reason to make an account at all).

## Key decisions (summary)

| Decision | ADR |
|---|---|
| No database; state rebuilt on boot | [ADR-0001](docs/decisions/adr-0001-no-database-in-memory-state.md) |
| Backend = JSON API + SPA bundle, no server UI | [ADR-0002](docs/decisions/adr-0002-backend-serves-api-and-spa-no-ui.md) |
| Structured error codes; client owns copy | [ADR-0003](docs/decisions/adr-0003-structured-error-codes-client-owns-copy.md) |
| Anonymous-first profiles | [ADR-0004](docs/decisions/adr-0004-anonymous-first-profiles.md) |
| Rooms sync via op log, replay on join | [ADR-0005](docs/decisions/adr-0005-op-log-room-synchronization.md) |
| Rooms created explicitly; joins never create | [ADR-0006](docs/decisions/adr-0006-explicit-room-creation-and-join-gating.md) |
| 5-char unambiguous room codes | [ADR-0007](docs/decisions/adr-0007-room-code-format.md) |
| `main` active, `main_backup` archive | [ADR-0008](docs/decisions/adr-0008-branch-structure-main-and-backup.md) |
| Engine: browser WASM + server UCI pool | [ADR-0009](docs/decisions/adr-0009-engine-strategy.md) |
| Weight-agnostic search index | [ADR-0010](docs/decisions/adr-0010-weight-agnostic-search-index.md) |
| External identity accounts (Lichess OAuth) | [ADR-0022](docs/decisions/adr-0022-external-identity-accounts.md) |
| Chat needs edit rights; owner deletes via op | [ADR-0023](docs/decisions/adr-0023-chat-permissions-and-moderation.md) |
| Reference tab for per-position data; search is a `#/search` destination | [ADR-0024](docs/decisions/adr-0024-reference-tab-and-search-destination.md) |
| Room-first; library supports, never the home | [ADR-0025](docs/decisions/adr-0025-room-first-surface-model.md) |

For how it all fits together (state model, channel protocol, data flow, testing), see
[`docs/architecture.md`](docs/architecture.md).

## Roadmap

Each milestone ends releasable; deploy is a manual `flyctl deploy` on `main`
(see [`docs/operations.md`](docs/operations.md)).

### Where we are (2026-08-13)

Milestones 1–6 done. Recently landed: one process per room (ADR-0012),
Horde clustering across `ams`/`ord` (ADR-0013), the read-only demo room at
`#/r/chess` (seeded on demand, ADR-0014), idle-room eviction (ADR-0016),
and the second code review's findings — all fixed (the Analysis split into
cursor/editor/keyboard hooks among them). Earlier: the design-system port
(`design/DESIGN-SYSTEM.md` is the UI spec), the in-browser engine,
free-form position setup (ADR-0011), comment popup (`c` key), secrets in
`fly secrets`, and a Playwright MCP for browser checks (`setup-mcp.sh`).
Next candidates: milestone 7 (server engine pool) or 8 (search), or 💡
ideas in FEATURES.md. Both reviews are fully closed (eviction + rate limit,
ADR-0016/0017).

**Spike 01 (position retrieval) is done** — standalone sub-project in
`spike/position_retrieval/` (the app itself is untouched; ADR-0001 intact):
canonical position key incl. the capturable-only en-passant convention,
corpus extraction (Lichess 2017-05), and store benchmarks (PostgreSQL /
SQLite / DuckDB / ETS / purpose-built flatfile) at 100k / 1M / 10M games.
Findings + recommendation:
[`docs/technical-spike-01-position-retrieval-report.md`](docs/technical-spike-01-position-retrieval-report.md).
The durable-storage decision it feeds is deliberately unmade.

**Spike 02 (similarity & relevance) is awaiting human evaluation** —
candidate generation is built and measured in `spike/position_retrieval/lib/sim/`
(12 reference positions × 7 retrieval strategies → 144 judgment units,
per-dimension annotations, self-contained eval sheet at
`spike/position_retrieval/data/sim-eval-sheet-100000.html` + judgments TSV
+ `mix spike.sim.tally` loop). Corpus evidence so far: exact retrieval is
a shallow-position luxury (97.9% of distinct keys occur once); pawn-skeleton
buckets are rich for repeated structures but degenerate to same-game
siblings for cold positions; following-move plan patterns exist but need
move-order-insensitive comparison. Report:
[`docs/technical-spike-02-similarity-and-relevance-report.md`](docs/technical-spike-02-similarity-and-relevance-report.md).

### Session handoff (2026-08-17)

**Chat permissions tightened (ADR-0023), shipped.** Viewers can no longer
post to room chat — owners and collaborators only (enforced in
`Room.submit_op` alongside the edit-op check; anonymous members can hold no
role, so they're excluded too). The owner can delete any message: a
`delete_chat` op naming the message's seq rides the op log like everything
else, and every client filters deleted seqs out of the visible history (the
original chat op stays in the log — append-only, ADR-0005). The UI: viewers
get a one-line "read along" hint instead of the input; the owner gets a ×
per message. 241 backend + 489 frontend tests green. The persistence spike
remains the user's and in flight — durable accounts / cross-device library
still wait on it. Next candidates: FEATURES.md text polish, or whatever the
spike unblocks.

**Later the same day:** the "learn from this game" report landed — a fifth
viz-box tab (Eval | Moments | Report | Material | Activity) with per-side
accuracy (lichess's per-move win-share-loss curve, a documented
approximation: no volatility weighting, no book exclusion), ??/?/?!
counts, a result + mainline-opening header, and every marked move with its
eval swing and the engine's best alternative, click to jump. Marks reuse
`moveMark` exactly, so report, move list and chart never disagree.
`winShare` moved from GameFlow to uci.ts. Two UI fixes rode along: the
room rail was capped at board height while the analysis sidebar gets board
+13rem — the squeeze gave Members a scrollbar with 2 members and pushed the
chat input over its panel's bottom border; the rail now matches the
sidebar's cap and ChatPanel is `shrink-0` (the squeeze lands on the
scrollable panels). And all five viz tabs are always present: Material and
Activity show a text placeholder until the game has moves (previously they
popped into existence on the first move). 502 frontend tests green.

**Layout direction decided (ADR-0024/0025), docs-only session.** The
growth question ("the screen has been growing since the start"; opening
book/tree, endgame table and extensive search are coming) was brainstormed
and settled: per-position reference docks in a new adaptive **Reference
tab**, whole-game views own the viz box exclusively, and search is a
**`#/search` destination** whose results enter rooms as a game or
variation. Endgame table deferred (a corpus can't provide tablebase
truth). The ChessBase alternative (database-first workspace home,
docked-pane room) was evaluated and rejected: room-first stays even with
a durable library ("a user lands in a room, backed by their library"),
and even ChessBase's own web apps dropped the MDI/ribbon model. All of it
is spike-gated — the corpus API unblocks Reference + search.

**Reference tab v0 shipped (corpus-free).** The ADR-0024 tab exists and
works without the spike: `continuationsFor` (openings.ts) computes the
named book continuations of the cursor position from the static
`openings.json` (3,809 positions); the panel descends locally (no ops),
re-anchors when the cursor moves, and editors insert the browsed path via
`add_line` — the engine-line gesture. ADR-0024 was amended at
implementation: the tab shows a text placeholder when off-book instead of
hiding (consistent with the viz tabs). **Revised the same day:** rows now
*play* the move (real broadcast op — the panel's re-anchor makes the
descent free) and preview it as a ghost arrow on hover; the local descent
+ insert machinery was deleted. Viewers preview only. Post-spike, the rows
gain corpus statistics; the tab itself doesn't change. Dev-ops note: `mix phx.server`
spawns Vite itself via the endpoint watcher — a manually started Vite on
5173 crashes it ("port in use"); just run `mix phx.server`.

### Session handoff (2026-08-16)

Since 2026-08-13 the analysis UI went through a big usability-driven,
lichess-inspired evolution (all shipped and deployed; 185 backend + 422
frontend tests green). What landed:

- **Layout**: navigation controls under the board always; one combined
  analysis panel (engine box with on/off + hint arrows, MultiPV 1–5, move
  list); sidebar height capped to the board column at xl; Settings tab
  removed; the app bar is app-level only — room actions live in a Room
  panel atop the rail (code/copy/leave, read-only badge).
- **Viz box** (Eval | Moments | Material | Activity, uniform height):
  game-flow eval chart (cp/win% toggle, blunder dots, book-exit marker,
  real WDL via `UCI_ShowWDL`), critical moments as mini boards, material
  timeline, piece-activity (mobility) timeline — the last two are pure
  FEN data, no engine (template for `docs/visualization_ideas.md` items).
- **Collaboration**: presenter handoff — the owner passes the mic to any
  member (ADR-0021); connection telemetry in the Room panel (10s `ping`
  probe → lag; you-vs-room region split asked on the room's node).
- **Games**: bulk PGN import (multi-game split + preview, imports all);
  export/save as header icons; the bookmark is membership-aware via PGN
  fingerprint until games have real ids.
- **Fixes worth remembering**: terminal positions store the game result
  instead of a sign-breaking `mate 0` (the mate-as-blunder bug);
  `createRoom` sends device credentials (ownerless-room race); API 401s
  re-heal the profile and retry (`withDeviceRetry`); ImportDialog mobile
  overflow.

Design stance going forward (user, 2026-08-16): *be flexible in how the UI
evolves — usability beats the earlier no-shift/no-scrollbar dogma, but do
it wisely.*

**Next up (user-requested, in order):** all three landed 2026-08-16, plus
two mobile fixes reported the same day. Later on 2026-08-16: mixed
multi-source imports (line-wise split: `https://lichess.org` lines →
Lichess, rest → PGN; bare ids dropped), import copy pluralized, the
activity feed removed (product call), the multi-import presenter-focus
fix, two features (**engine line → variation** — atomic `add_line` op —
and **NAG glyphs**), nested variations as indented blocks with a
line-path breadcrumb, and the zoom-safe tour tooltip. A persistence
spike is in flight (user) — search/accounts/durability wait on it.

**Lichess OpenID (ADR-0022) — all three phases landed 2026-08-16,** with
the model the user designed: one "Sign in with Lichess" action — the
callback binds new accounts to the current profile and adopts the known
profile when bound (names follow the binding across browsers; fun names
are temporary by design), "Sign out" detaches and clears the mapping.
Scope is `study:read` only (games endpoints are public — there is no
`game:read` scope; learned live). Lichess needs no app registration
(unregistered public PKCE clients; client id is any unique string).
The lichess knight mark is inlined from lila (AGPLv3, compatible with
our GPLv3; attribution in the cburnett NOTICE.txt). Import dialog tabs:
Paste | My Lichess studies (every chapter imports) | My games
(multi-select recent games) | **Chess.com** — username-driven monthly
archive browsing with multi-select, strictly via the official public API
(their robots.txt/User Agreement forbid callback/service endpoints and
scraping; checked before building). **Room chat** rides the op log
(`chat` op; replay = history; any member can write). **Canonical URL is
`https://blunderfest.org`** — `blunderfest.fly.dev` is the raw Fly
domain and doesn't work properly (CORS etc.). A persistence spike is in
flight (user) — account durability and the game library's cross-device
half wait on it.

1. **Room panel location display** — DONE: region/lag is one compact
   truncating line inside the box, under the code/copy/leave row.
2. **Guided tour** — DONE: hand-rolled spotlight (box-shadow dim +
   tooltip), `data-tour` landmarks, steps that don't resolve are skipped.
   Room-only, from the app-bar help menu (user review: the landing page
   needs none, no auto-start), which also revived the (previously
   unreachable) keyboard-shortcuts dialog.
3. **Bulk import** — DONE: `PGN.parse_many/1` is per-game now
   (`{:ok, trees, failures}`); the dialog lists skipped games with reasons
   and imports the rest. Reproduced with a real 5-game lichess export
   (Chess960/Antichess/Horde fail, standard games import).
4. **Mobile fixes** — DONE: the analysis wrapper shrink-wrapped to
   max-content and let the page pan sideways once PV lines rendered (now
   `w-full`/`max-w-full` down the chain; vw-fixed widths are min-content
   landmines — cap with max-w instead); the move list's `scrollIntoView`
   dragged the page — it scrolls only its own container now; `1-0` no
   longer wraps at the hyphen in the eval-bar label, title row, or engine
   badge. The eval bar also bled over the rail at md (768–900px): the
   board width formula ignored the rail — it subtracts it at md now, and
   the slot margin applies whenever the bar hangs out of flow. Viz box
   tabs carry one-line captions explaining each visualization.

**Session notes for the next session:**

- Checks: `mix precommit`; in `assets/`: `pnpm lint && pnpm typecheck &&
  pnpm exec vitest run --pool=forks`. Deploy: commit → push → `flyctl deploy`.
- Vite exits silently on closed stdin — start it as
  `(tail -f /dev/null | node node_modules/vite/bin/vite.js &)`. Kill dev
  servers with `fuser -k 4000/tcp 5173/tcp`.
- Engine-free local runs: `STOCKFISH_PATH=/tmp/opencode/fakefish.sh mix phx.server`.
- Two profiles in one browser context are impossible (shared localStorage =
  one identity). For a second profile: `POST /api/profiles` via fetch,
  `localStorage.setItem('blunderfest.device', …)`, reload **via about:blank**
  (same-URL navigation does not reload).
- Playwright screenshots land in the repo root — delete before committing.
- Never stage/commit the user's WIP: `spike/`, `screenshots/`,
  `docs/technical-spike-*.md`, `docs/evaluation.html`,
  `docs/visualization_ideas.md`, `docs/glossary.md`,
  `docs/functional-design.md`. Stage own files explicitly; zsh executes
  backticks inside commit messages.

1. **Boot** — DONE. Phoenix 1.8 / React 19 + Vite + TypeScript building into
   `priv/static`, `/api/healthz`, channel socket, i18n scaffold, Dockerized
   release, Fly config, in-memory state (ADR-0001).
2. **Anonymous profiles** — DONE. Fun name + device secret, salted hashes, zero
   stored PII, bearer auth (ADR-0004).
3. **Import** — DONE. PGN paste and Lichess URL import → variation tree, shared
   in rooms. (In-memory storage; "DB" only when a DB exists.)
4. **Solo board** — DONE. Hand-rolled board, navigation, arrows, highlights,
   comments, Stockfish WASM eval bar + best-move hints (ADR-0009). Remaining
   from the engine scope: blunder flags while dragging.
5. **Rooms** — DONE. Channel per slug, op-log sync (ADR-0005), presence, roles,
   cursors, multiple games. Remaining: profile game library.
6. **Save/export** — DONE. Annotated PGN export (client-side serializer,
   setup analysis as extra games) and the per-profile game library
   (session-scoped, ADR-0020). The durable, account-bound half of claiming
   waits on the storage decision.
7. **Server engine pool** — DONE. UCI workers, whole-game reports, eval charts (ADR-0009).
8. **Search** — position extraction job, weighted similarity metric + decomposition,
   golden-fixture tests, bulk corpus import, configurable search UI (ADR-0010).

## Development conventions

- Keep this file current: roadmap statuses, and anything a fresh session needs.
- Record significant decisions as ADRs in `docs/decisions/` at decision time.
- Commit in small, milestone-scoped steps.
