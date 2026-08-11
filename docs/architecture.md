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
    `create/2`, `claim/2`, `append/2`, `ops/1`, `roles/1`, `valid_code?/1`,
    `room_exists?/1`, `read_only?/1`, `approval_status/3`. The op log is the
    room's authoritative state (ADR-0005); joins never create rooms (ADR-0006).
    Ops are stored prepended with a counter (O(1) append). Rooms created
    `read_only: true` record no members and allow no edits.
  - `DemoRoom` — the read-only demo room at the reserved code `chess`
    (ADR-0014): a fixed annotated game, seeded on demand when a channel join
    targets the code (so it survives room-process and node loss). The create
    endpoint rejects the reserved code with `code_reserved`.
  - `Profiles` (GenServer): anonymous profiles with salted device-secret
    hashes (ADR-0004), `authenticate/2`, fun-name generation.
  - `pgn.ex`, `game/tree.ex`, `game/moves.ex` — PGN parsing to a variation
    tree, and legal-move validation (used to validate `move_at_ply` ops).
  - `lichess.ex` — fetches PGNs from Lichess for URL imports.
  - `secrets.ex` — hashing helpers.
- `lib/blunderfest_web/` — HTTP and channel surface:
  - `router.ex` — `/api` scope: `healthz`, `profiles`, `rooms`, `import/pgn`,
    `import/lichess`, `games/moves`; catch-all for the SPA.
  - `controllers/` — thin: validate params, call domain, return structured
    JSON. Errors use `error_json.ex` with machine-readable codes (ADR-0003).
  - `channels/room_channel.ex` — `join` gates by validity → existence →
    approval, then claims and pushes `{ops, roles}`; `op` events validate and
    append; `set_role` events enforce permissions; replies and broadcasts
    (`new_op`, `role_update`) are the client's single application path.
  - `user_socket.ex` + `presence.ex` — Phoenix Presence for member lists.

### State lifecycle

No database (ADR-0001). `Rooms` and `Profiles` start empty on boot and are
rebuilt by use; a scale-to-zero instance loses nothing critical. The Fly
machines form one Erlang cluster (DNSCluster + `DNS_CLUSTER_QUERY`), so a
room process running in `ams` is reachable from `ord` and vice versa. The
demo room follows the same rule: nothing seeds it at boot — the first join
to its reserved code re-seeds it (ADR-0014).

### Channel protocol

Topic `room:<slug>`. Join reply: `{ops: Op[], roles: {member_id => role},
region, read_only}`. Events: `op` (push) → `new_op` (broadcast echo);
`set_role` → `role_update`. Presence events `presence_state` /
`presence_diff` carry member names. Ops are type-tagged payloads
(`move_at_ply`, `comment_at_ply`, `set_game`, `select_game`, `set_cursor`,
`set_role`, ...) with `seq`, `author`, `ts` — the shared vocabulary is
mirrored in `assets/src/protocol/ops.ts`. Read-only rooms (the demo) are the
exception: no presence is tracked and every `op` push is rejected with
`:read_only`, so clients send nothing and hide the member list.

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
  `useRoomChannel` (join, op/role/presence handling, `sendOp`/`sendRole`;
  events from superseded channels are ignored), `RoomHeader`, `MemberList`,
  `GameList`, `ActivityFeed`.
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
