# Architecture

Blunderfest is a collaborative chess analysis app: import games, analyze solo
or with other people in real time. Two halves — a Phoenix backend that owns
all state and a React SPA that owns all UI — deployed as one artifact.

```
Browser (React SPA)
   │                        │
   │ JSON /api/*            │ Phoenix Channels (websocket /socket)
   ▼                        ▼
Phoenix backend ── one `Room` GenServer per room (Horde cluster, ADR-0013); Profiles (in-memory state)
```

## Backend (Phoenix, no UI)

See ADR-0002. The backend is an API and a socket; the SPA is bundled into the
release and served by a catch-all (`SpaController`).

- `lib/blunderfest/` — pure domain logic and state, no HTTP:
  - `Rooms` (facade): per-slug room state `%{seq, ops, owner, roles}` lives in
    one `Room` GenServer per room (ADR-0012), registered by slug in a Horde
    Registry and started on demand under a Horde DynamicSupervisor —
    cluster-wide, so rooms are reachable from every Fly region (ADR-0013).
    `create/2`, `claim/2`, `append/2`, `submit_op/3` (permission check +
    append, atomically), `join_snapshot/3` (claim + ops/roles/read_only in
    one call), `ops/1`, `roles/1`, `valid_code?/1`, `room_exists?/1`,
    `read_only?/1`, `approval_status/3`. The op log is the room's
    authoritative state (ADR-0005); joins never create rooms (ADR-0006).
    Ops are stored prepended with a counter (O(1) append). Rooms created
    `read_only: true` record no members and allow no edits.
  - `DemoRoom` — the read-only demo room at the reserved code `chess`
    (ADR-0014): a fixed annotated game, seeded on demand when a channel join
    targets the code (so it survives room-process and node loss). The create
    endpoint rejects the reserved code with `code_reserved`.
  - `Profiles` (GenServer): anonymous profiles with salted device-secret
    hashes (ADR-0004), `authenticate/2`, fun-name generation.
  - `pgn.ex`, `game/tree.ex` — PGN parsing to a variation tree. Move
    legality and SAN are computed client-side (chess.js); the server checks
    op shape, not chess rules. `PGN.parse_many/1` parses each game
    independently: `{:ok, trees, failures}` with per-game `%{index, detail}`
    failures, so one unparseable game (variants, from-position quirks)
    never sinks a multi-game import; the import endpoint reports the
    failures alongside the trees.
  - `lichess.ex` — fetches PGNs from Lichess for URL imports.
  - `engine/pool.ex` + `engine/worker.ex` — the batch engine layer
    (ADR-0009): a pool of Stockfish binaries speaking UCI over Ports,
    queued with backpressure and crash replacement.
  - `game_analysis.ex` — whole-game analysis jobs (one per room, registered
    in `AnalysisJobs`): progress broadcasts, then the evals land as a
    `set_analysis` op in the room's log.
  - `secrets.ex` — hashing helpers.
- `lib/blunderfest_web/` — HTTP and channel surface:
  - `router.ex` — `/api` scope: `healthz`, `profiles`, `rooms`, `import/pgn`,
    `import/lichess`; catch-all for the SPA.
  - `controllers/` — thin: validate params, call domain, return structured
    JSON. Errors use `error_json.ex` with machine-readable codes (ADR-0003).
  - `channels/room_channel.ex` — `join` gates by validity → existence →
    approval, then claims and pushes `{ops, roles}`; `op` events validate and
    append; `set_role` events enforce permissions; replies and broadcasts
    (`new_op`, `role_update`) are the client's single application path.
  - `user_socket.ex` + `presence.ex` — Phoenix Presence for member lists.
  - `room_sweeper.ex` — evicts idle, unwatched rooms (ADR-0016); lives in
    the web layer because membership is read from Presence.

### State lifecycle

No database (ADR-0001). `Rooms` and `Profiles` start empty on boot and are
rebuilt by use; a scale-to-zero instance loses nothing critical. The Fly
machines form one Erlang cluster (DNSCluster + `DNS_CLUSTER_QUERY`), so a
room process running in `ams` is reachable from `ord` and vice versa. The
demo room follows the same rule: nothing seeds it at boot — the first join
to its reserved code re-seeds it (ADR-0014). Rooms also expire: the
`RoomSweeper` stops rooms that have been idle **and** unwatched for an
hour (ADR-0016), so the room cap refills itself.

### Channel protocol

Topic `room:<slug>`. Join reply: `{ops: Op[], roles: {member_id => role},
region, room_region, presenter, read_only}` (one atomic room call;
`room_region` is asked on the room's own node, `presenter` is the member
the mic was handed to or nil = owner, ADR-0021). Events: `op` (push) →
validated
shape-first by `Blunderfest.Ops` (including a recursive shape/depth/node
cap for `set_game` trees), then permission-checked and appended atomically
by the room process → `new_op` (broadcast echo); `set_role` →
`role_update`; `set_presenter` (owner only) → `presenter_update`;
`ping` is a no-op probe the client uses for lag telemetry.
Clients apply echoes strictly in `seq` order; a `seq` gap
means an echo was lost or reordered, so the client resyncs by rejoining
(replay is the one application path, ADR-0005). Presence events
`presence_state` / `presence_diff` carry member names. Ops are type-tagged
payloads (`move_at_ply`, `comment_at_ply`, `set_game`, `select_game`,
`set_cursor`, `set_role`, ...) with `seq`, `author`, `ts` — the shared
vocabulary is mirrored in `assets/src/protocol/ops.ts`. `analyze_game` (push, editors
only) starts a whole-game engine job; progress arrives as transient
`analysis_progress` events and the result as a `set_analysis` op replayed
on join like everything else. Read-only rooms (the demo) are the exception:
no presence is tracked and every `op` push is rejected with `:read_only`,
so clients send nothing and hide the member list.

## Frontend (React 19 + Vite + TypeScript)

- `assets/src/app/App.tsx` — hash routing (`#/r/<code>` rooms, anything else
  home; strict code regex, ADR-0007), backend health check, profile bootstrap.
- `assets/src/lib/` — API client (`api.ts`: `request<T>`, `ApiError`,
  `createProfile`, `fetchProfile`, `createRoom`, `importPgn`, `importLichess`),
  device secret in `localStorage` (`device.ts`,
  `blunderfest.device`), profile hook (`useProfile.ts`), room code helpers
  (`roomCode.ts`), Phoenix socket wiring (`socket.ts`).
- `assets/src/store/room.ts` — Redux Toolkit room store: mirrors the op log
  (`applyOp`, `replayOps`), games map, presence, roles; selectors derive
  presenter, following, can-edit, activity feed.
- `assets/src/features/room/` — `RoomView` (layout, join/not-found states),
  `useRoomChannel` (join, op/role/presence handling, `sendOp`/`sendRole`,
  10s ping loop → `lagMs`; events from superseded channels are ignored),
  `RoomPanel` (code/copy/leave + a single-line region/lag readout inside
  the box), `MemberList` (follow toggle, presenter handoff), `GameList`,
  `ActivityFeed`.
- `assets/src/features/tour/` + `assets/src/app/HelpMenu.tsx` — the guided
  tour: a hand-rolled spotlight (a ring whose box-shadow dims the page) and
  tooltip stepping through `data-tour` landmarks; steps that don't resolve
  are skipped. Room-only (the landing page doesn't need one), started from
  the app-bar help menu, which also houses the keyboard-shortcuts dialog.
- `assets/src/features/analysis/` — the board: hand-rolled `Board.tsx`
  (keyboard-playable squares, drag, arrows, highlights, roles), `Analysis`
  (navigation, comments, present/follow), `legalMoves.ts` (client-side legal
  moves + resulting fen/status via chess.js — no server round trip),
  `moveList.ts`/`MoveList.tsx`
  (variation tree), `nodeMap.ts` (ply ↔ node index), `BoardControls`,
  `GameInfo`, `NodeComment`.
- `assets/src/features/analysis/engine.ts` + `useEngine.ts` + `uci.ts` +
  `EvalBar.tsx` — in-browser Stockfish 18 Lite (WASM, single-threaded, in a
  classic Web Worker via the `#<wasm-url>,worker` hash convention; ADR-0009).
  The `ChessEngine` interface (`init`/`analyze`/`terminate`) is injectable for
  tests; `useEngine` debounces position changes, aborts stale searches, and
  normalizes scores to white's perspective. The UI is the `EvalBar` beside
  the board plus the best move as an arrow overlay (`Board`'s `arrows` prop).
- `assets/src/features/analysis/openings.ts` — opening classification
  (ECO + name under the players): a static book (lichess-org/chess-openings,
  CC0) built at `pnpm build` into `public/openings.json` by
  `scripts/build-openings.mjs` — position keys (placement + side + castling)
  to `ECO|Name`, so transpositions match and the en-passant-field convention
  can't break lookups. The name is the deepest book position on the *viewed*
  line, so it refines going deeper, sticks off-book, and follows variations.
- `assets/src/components/ui.ts` — `tv()`-based component variants (Tailwind
  v4, dark theme); `<.icon>`-style icons are heroicons via the `.icon` /
  `Icon` components. The visual language (tokens, states, motion) is specced
  in `design/DESIGN-SYSTEM.md`, which maps directly onto the `@theme` tokens
  in `assets/src/app/app.css` and these variants.
- i18n: `react-i18next`, `assets/src/i18n/locales/en.json` is the
  source-of-truth locale; all copy lives here (ADR-0003).

### Data flow in a room

1. Home "Create" → `POST /api/rooms` → navigate to `#/r/<code>` (ADR-0006).
   Join-by-code and deep links go straight to the room.
2. `useRoomChannel` joins `room:<slug>`; server replies `{ops, roles}`;
   `replayOps` rebuilds games; presence fills the member list.
3. User moves a piece → `sendOp({type: 'move_at_ply', ...})` → server validates
   and appends → broadcasts `new_op` → **every** client applies it. The sender
   never applies locally; the echo is the only path (ADR-0005).

## Testing

- Backend: ExUnit. Domain tests hit the GenServers directly; controller tests
  are `async: false` and reset `Profiles`/`Rooms` in setup; channel tests use
  the real `RoomChannel` against `Phoenix.ChannelTest` with pre-created rooms.
  Run: `mix precommit`.
- Frontend: Vitest (`--pool=forks`), Testing Library + jest-axe for a11y. The
  Phoenix channel is abstracted behind a `channelFactory` prop injected as a
  `FakeChannel` in tests. Run: `pnpm lint && pnpm typecheck && pnpm exec vitest run --pool=forks`
  in `assets/`.
