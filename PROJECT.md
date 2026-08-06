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
6. **Save/export** — annotated PGN export, room/game claiming.
7. **Server engine pool** — UCI workers, whole-game reports, eval charts (ADR-0009).
8. **Search** — position extraction job, weighted similarity metric + decomposition,
   golden-fixture tests, bulk corpus import, configurable search UI (ADR-0010).

## Development conventions

- Keep this file current: roadmap statuses, and anything a fresh session needs.
- Record significant decisions as ADRs in `docs/decisions/` at decision time.
- Commit in small, milestone-scoped steps.
