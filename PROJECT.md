# Blunderfest — Project Decisions & Roadmap

Collaborative chess analysis: import games, analyze solo or with other people in real
time, and search a growing corpus of positions (exact and *similar*).

This document is the single source of truth for architectural decisions and the roadmap.
Future sessions must read this file first and keep it up to date as decisions change.

## Hard constraints

- Backend: **Elixir + Phoenix**, real-time via **Phoenix Channels**, plain **JSON API**.
- **The backend contains no UI.** No LiveView, no HTML views, no server-rendered
  markup. It exposes the JSON API and channel sockets, and hands out the compiled
  React bundle (a static `index.html` shell + hashed assets) to browsers. React
  owns all UI.
- Frontend: **React 19** (Vite build, bundled by Phoenix for a single-app deploy).
- No hard release deadline; hobby project, but built **as if it will be shipped** —
  releasable at every milestone.

## i18n

- The **server never returns prose**. The JSON API answers with structured error
  codes and machine-readable data; clients own all copy.
- The **React app owns all user-facing strings** via `react-i18next`, with English
  as the source-of-truth locale and room for more locales.
- Chess content (SAN moves, FEN, PGN) is language-neutral; user-authored content
  (comments/line names) is stored raw.
- No server-side gettext.

## Core principles

1. **Anonymous-first, zero PII.** Anyone can use the whole product without an account.
   Signing up is purely for keeping track of games/analysis. No email, no name, no
   external identity providers, no magic links.
2. **Open collaboration.** Anyone with an (unguessable) room link joins as a full
   editor. No permission restrictions.
3. **Analysis is unstructured.** The board is a canvas: moves, variations, arrows,
   comments, region highlights (even across several plies). Hand-rolled board
   component — no board library.
4. **Search is a marquee feature.** Same *and* similar positions (colors reversed,
   piece shifted one square, piece-type substitution, same pawn structure, …),
   with **user-configurable similarity weights** from day one.
5. **Correctness first.** The similarity metric ships with golden-fixture tests.

## Product model

- **Games** — imported PGNs (paste first; Lichess link-import right after).
  Any game can be analyzed by anyone.
- **Rooms** — a persistent shared analysis session pinned to a game. Anyone with the
  unguessable slug joins as a full editor (Google-Docs-style). Games can live in
  rooms indefinitely.
- **Profiles** — an account is a **handle + a secret passphrase** (no PII).
  The server stores only a salted hash of the secret; clients hold a device token
  (localStorage). Claiming a room/game = attaching it to your profile.
- **Game library** — per-profile collection of owned/claimed games; a first-class
  early feature (the reason to make an account at all).

## Real-time architecture (channels)

- One Phoenix Channel topic per room slug.
- A chess analysis board is a **tree of variations** with annotations at nodes — the
  protocol treats it that way.
- **Authoritative state = the room's operation log** (`ops` table:
  `room_id, seq, type, payload, author, ts`). Clients replay ops on join, then
  subscribe to new ones. No whole-document last-writer-wins.
- Granular operations: `move_at_ply`, `replace_line`, `comment_at_ply`,
  `add_arrow`, `add_highlight`, `set_cursor`, … Conflicts collapse naturally because
  variations are keyed by ply.
- **Late join / reconnect / crash recovery / undo timeline** all fall out of replaying
  ops from the last seen `seq`.
- **Presence** (who's in the room) via Phoenix Presence; cursor/arrow broadcasts are
  throttled.
- Every collaborative visual (selected piece, arrows) travels with the op — that is
  what makes co-editing feel like co-thinking.

## Engine strategy

| Layer | Mover | Purpose |
|---|---|---|
| Interactive | **Stockfish WASM in the browser** | instant eval bar, best-move hint, blunder flags while dragging |
| Batch | **Server-side UCI worker pool** | "analyze whole game" jobs → per-ply evals stored → eval-curve chart; consistent truth for multiplayer |

Server pool: a supervised pool of N Stockfish binary processes (UCI protocol over
Elixir ports), pipelined over a `:queue`. No mature hex package exists for this —
write `Blunderfest.Engine.Pool` as a clean, self-contained module, testable against a
mock engine.

## Frontend architecture

- **React 19 + Vite** inside the Phoenix `assets/` dir; Vite outputs to
  `priv/static` (outDir `../priv/static`, `emptyOutDir: false`). Phoenix serves the
  compiled `index.html` shell + assets; a catch-all route hands non-API requests to
  the SPA.
- **Dev flow:** Vite dev server on `:5173` (HMR), proxying `/api` and `/socket` to
  Phoenix on `:4000`. Prod: single Phoenix origin.
- **Hand-rolled board component** — drag-drop, arrows, eval circles, region
  highlights, variations tree in the move list. Board renders *overlays*;
  annotations are first-class: `{type: highlight, plies: [15..19], squares: [...],
  color}`.
- `chess.js` for rules/legal moves. Zustand-style store mirroring the room op log.
- `phoenix` npm client mounted via a `useRoomChannel` hook.
- Board state is pure: `position + move history + variations + evals` =
  serializable snapshot → trivial tests, replay, export.

## Data model (initial)

```
profiles          (id, slug, handle, secret_hash)
games             (id, slug, pgn, white, black, result, eco, owner_profile_id?)
rooms             (id, slug, game_id)
ops               (room_id, seq, type, payload, author, ts)
positions         (id, game_id, ply, full piece maps + prefilter keys, indexed)  ← search
engine_reports    (game_id, ply, score, best_line)
```

PGN export serializes ops → annotated PGN; import parses PGN → tree.

## Search design (configurable, "perfect the first time")

### Why config-first changes the index

If weights were fixed we could bake them into index keys. With user-configurable
weights the index must be **weight-agnostic**:

- `positions` rows store **full piece maps** (per-color square+type sets) plus cheap
  **prefilter buckets** (pawn structure, material, piece count), all indexed.
- Prefilters narrow candidates; real ranking is computed live with the user's
  weights. **Changing weights never requires re-running the corpus.**

### The metric

Position similarity = minimum-cost transformation between two piece multisets
(white/black separately):

- **match** — same piece, square, type: cost 0
- **shift** — a piece moved `n` squares: `n × shift_weight`
- **substitute** — same square, different type (rook↔bishop): `subst_weight`
- **add / remove** — piece appears/disappears: `change_weight`
- **color flip** — applied to the query when enabled: free (0) vs `flip_weight`
- scope toggle: **full position** or **pawn structure only**

It's an assignment problem, but ≤32 pieces + tight prefilters make greedy assignment
+ refinement exact enough — and the winning assignment *decomposes* into the result
labels ("pawn h3→h2", "rook→bishop", "colors reversed"): the explanation is a free
byproduct of the metric.

### UX

Search panel from any board position: presets **Exact / Relaxed colors / Morphology
(type-blind) / Pawn structure only / Custom**, plus per-transformation sliders in
Custom. The config rides along in the "find similar" op. Results are ranked, labeled
with the matched transformation, and jump to game at ply.

### Corpus

Importing a game spawns a background job that replays the PGN and extracts one
`positions` row per ply. **Bulk PGN archive import** (e.g., Millionbase) is in scope
for v1 search — otherwise "search this position" is meaningless on a tiny corpus.

### Testing

- Golden-fixture ExUnit tests: hand-computed positions with known pairwise distances,
  assert ordering.
- Property tests: metric validity (e.g., symmetric under color flip).

## Roadmap

Each milestone ends releasable; the existing Fly setup deploys continuously.

1. **Boot** — DONE. Phoenix (1.8.9 / Elixir 1.20 / OTP 29), React 19 +
   Vite + TypeScript skeleton building into `priv/static`, `GET /api/healthz`,
   channel socket at `/socket/websocket`, i18n scaffold (react-i18next), CI
   (backend + frontend), Dockerized release, Fly config. No database: state is
   in-memory for now (see Infra / deploy notes). Verified locally and in a
   built Docker image.
2. **Anonymous profiles** — handle + secret, salted hashes, device tokens, zero
   PII. In-memory store (ETS/Agent) first; a persistent DB is deferred.
3. **Import** — PGN paste → tree → DB. Lichess link-import immediately after.
4. **Solo board** — hand-rolled board, navigator, arrows, region highlights, comments,
   browser-WASM Stockfish eval bar + best-move hints. No server needed.
5. **Rooms** — channel per slug, op-log sync, presence, cursors; early profile game
   library.
6. **Save/export** — annotated PGN export, room/game claiming.
7. **Server engine pool** — UCI workers, whole-game reports, eval charts.
8. **Search** — position extraction job, weighted similarity metric + decomposition,
   golden-fixture tests, bulk corpus import, configurable search UI.

## Infra / deploy notes

- `fly.toml` deploys a single app, regions ams + ord, scale-to-zero
  (`auto_stop_machines`), Port 8080. Deploys on push to the `restart` branch.
  Requires `SECRET_KEY_BASE` (in `fly.toml`).
- **Known issue:** scale-to-zero + websocket reconnects — revisit
  `min_machines_running` (likely 1) at milestone 5.
- `.github/workflows/ci.yml` (backend + frontend tests) and `fly.yml` (deploy)
  exist. Release is built by the multi-stage `Dockerfile` (Node stage builds
  assets, Elixir stage compiles a release that serves them).
- **No database for now.** Ecto/Postgres deps were removed; all state lives
  in-memory (agents/ETS) and is rebuilt on boot, so a scale-to-zero instance
  loses nothing critical. Reintroduce a DB only with explicit approval.
- Dev toolchain bootstrap lives in `execute.sh` (idempotent; Arch packages +
  Postgres init; `flyctl` for deploys/provisioning).

## Development conventions

- Keep this file current: architecture decisions, roadmap changes, and anything a
  fresh session needs to continue from.
- Commit in small, milestone-scoped steps.
