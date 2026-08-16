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

**Next up (user-requested, in order):**

1. **Room panel location display** — the region/lag text sits in the panel
   header and wraps badly in the narrow rail (see
   `screenshots/RoomSection.png`). Move it *into the box* (the
   code/copy/leave row), compact and single-line. `RoomPanel.tsx`.
2. **Guided tour** — a first-run tour; the app has grown a lot of UI.
   Decide: hand-rolled spotlight + tooltip (fits the no-library ethos) vs
   a tiny lib (e.g. driver.js). Persist a seen-flag in localStorage,
   re-trigger from the help menu, strings in `assets/src/i18n/locales/en.json`.
3. **Bulk import fails on multi-game lichess exports.** Reproduce first
   with a real export (`https://lichess.org/api/games/user/<name>?max=5`
   as PGN). Prime suspect: `PGN.parse_many/1` is all-or-nothing — the
   first failing game halts the whole batch, and lichess exports can
   contain unparseable oddities (variants, from-position/Chess960 games).
   Likely fix: per-game error collection (import what parses, report the
   failures in the dialog). Also consider stripping lichess `[%clk …]` /
   `[%eval …]` comments on import, and check `@max_pgn_bytes` (256 KB)
   against large exports.

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
7. **Server engine pool** — UCI workers, whole-game reports, eval charts (ADR-0009).
8. **Search** — position extraction job, weighted similarity metric + decomposition,
   golden-fixture tests, bulk corpus import, configurable search UI (ADR-0010).

## Development conventions

- Keep this file current: roadmap statuses, and anything a fresh session needs.
- Record significant decisions as ADRs in `docs/decisions/` at decision time.
- Commit in small, milestone-scoped steps.
