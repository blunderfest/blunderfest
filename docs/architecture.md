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
    hashes (one per device, ADR-0004), `authenticate/2`, fun-name
    generation, linked external **accounts** (lichess username + OAuth
    token, ADR-0022) and `issue_secret/1` for cross-device recovery.
  - `LichessAuth` (GenServer): ephemeral OAuth state/PKCE verifiers and
    the single-use recovery exchange codes.
  - `lichess.ex` — fetches PGNs from Lichess for URL imports, plus the
    OAuth calls (authorize URL, token exchange, `/api/account`) and the
    linked-account study/games fetches (ADR-0022).
  - `chesscom.ex` — chess.com game browsing for import, strictly via the
    official public API (`api.chess.com/pub`); their robots.txt/User
    Agreement forbid callback/service endpoints and scraping, so no other
    channel is used. Monthly archives carry full PGNs inline.
  - `pgn.ex`, `game/tree.ex` — PGN parsing to a variation tree. Move
    legality and SAN are computed client-side (chess.js); the server checks
    op shape, not chess rules. `PGN.parse_many/1` parses each game
    independently: `{:ok, trees, failures}` with per-game `%{index, detail}`
    failures, so one unparseable game (variants, from-position quirks)
    never sinks a multi-game import; the import endpoint reports the
    failures alongside the trees.
  - `engine/pool.ex` + `engine/worker.ex` — the batch engine layer
    (ADR-0009): a pool of Stockfish binaries speaking UCI over Ports,
    queued with backpressure and crash replacement.
  - `game_analysis.ex` — whole-game and variation-line analysis jobs (one
    per room, registered in `AnalysisJobs`): progress broadcasts, then the
    evals land as a `set_analysis` op in the room's log. Positions carry
    the client's deterministic node ids, so evals are node-keyed and
    multiple ops merge per node (a re-run overrides; a line analysis adds
    its variation without clobbering the mainline's).
  - `secrets.ex` — hashing helpers.
  - `historical_evidence.ex` — the historical-evidence service (ADR-0027):
    FEN in, a serializable evidence DTO out — the stable API between the UI
    and the corpus boundary. Facts only: no relevance score, no
    interpretation.
- `lib/blunderfest/corpus/` — the corpus boundary (ADR-0026, ADR-0027);
  application code never sees its internals:
  - `corpus.ex` — the facade GenServer: owns the Postgrex pool and
    delegates every query; starts unconfigured (inert) when no `db:`
    config exists, e.g. dev without `DATABASE_URL`.
  - `position_key.ex` — canonical position identity (Spike 01): the
    capturable-only en-passant convention, 128-bit BLAKE2b hashes.
  - `replay.ex` + `extraction.ex` — lean mainline replay and the streaming
    PGN → occ/games/moves/keys artifact pipeline (mix `corpus.extract`).
  - `occurrences.ex` — the PG store: COPY-loaded, UNLOGGED, rebuildable
    (mix `corpus.load`); positions carry the 63-bit pawn bucket hash.
  - `analysis/` — pure analysis modules: `Features` (bitboard dimensions),
    `Differences` (typed differences + the §8 dims report), `Route`
    (Spike 05 route comparison), `Continuation` (windows, representations,
    similarities), `Families` (Spike 04 single-linkage menus),
    `Skeleton` (Spike 06 per-side membership layer), `Counts`
    (occurrences vs games, same-game/singleton flags).
  - `search/candidates.ex` — exact + pawn-skeleton retrieval, capped and
    independently observable.
  - `search/pipeline.ex` — the vertical-slice orchestrator: per-candidate
    evidence with per-stage timings.
- `lib/blunderfest_web/` — HTTP and channel surface:
  - `router.ex` — `/api` scope: `healthz`, `historical-evidence`,
    `profiles`, `rooms`, `import/pgn`,
    `import/lichess`, `import/lichess-study`, `import/lichess-games`,
    `lichess/studies`, `lichess/games`, `chesscom/games`,
    `auth/lichess/start`, `auth/exchange`, `auth/unlink`; `/auth` scope:
    `lichess/callback`; catch-all for the SPA.
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

No database for application data (ADR-0001). `Rooms` and `Profiles` start
empty on boot and are rebuilt by use; a scale-to-zero instance loses nothing
critical. The Fly machines form one Erlang cluster (DNSCluster +
`DNS_CLUSTER_QUERY`), so a room process running in `ams` is reachable from
`ord` and vice versa. The demo room follows the same rule: nothing seeds it
at boot — the first join to its reserved code re-seeds it (ADR-0014). Rooms
also expire: the `RoomSweeper` stops rooms that have been idle **and**
unwatched for an hour (ADR-0016), so the room cap refills itself.

The one persistence exception is the corpus (ADR-0026): a Fly Postgres
cluster (`blunderfest-db`, `ams`, non-HA) holds the occurrence data behind
the `Blunderfest.Corpus` boundary, accessed via Postgrex (no Ecto).
Everything after the canonical PGNs is derived and rebuildable
(`mix corpus.extract` + `mix corpus.load`). `DATABASE_URL` is a deployed
secret parsed in `config/runtime.exs`.

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
payloads (`move_at_ply`, `add_line` (a whole line in one op — engine lines
become variations atomically), `comment_at_ply`, `set_nags`, `set_game`,
`select_game`, `set_cursor`, `set_role`, `chat` (room chat — replay is the
history), `delete_chat` (owner moderation; the chat op stays in the log,
clients filter it from view), ...) with `seq`,
`author`, `ts` —
the shared vocabulary is mirrored in `assets/src/protocol/ops.ts`. Chat ops
(`chat`, and the owner-only `delete_chat` moderation op — ADR-0023) need edit
rights: owners and collaborators post, viewers read along. `analyze_game` (push,
editors only) starts a whole-game engine job; progress arrives as transient
`analysis_progress` events and the result as a `set_analysis` op replayed
on join like everything else. Read-only rooms (the demo) are the exception:
no presence is tracked and every `op` push is rejected with `:read_only`,
so clients send nothing and hide the member list.

## Frontend (React 19 + Vite + TypeScript)

- `assets/src/app/App.tsx` — hash routing (`#/r/<code>` rooms, anything else
  home; strict code regex, ADR-0007), backend health check, profile bootstrap.
- `assets/src/lib/` — API client (`api.ts`: `request<T>`, `ApiError`,
  `createProfile`, `fetchProfile`, `createRoom`, `importPgn`, `importLichess`).
  `features/import/importSources.ts` splits the import box line-wise into
  Lichess URLs (lines starting `https://lichess.org`) and PGN text, so any
  mixture imports in one go; skips per game/URL are reported in the dialog.
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
  the box), `MemberList` (follow toggle, presenter handoff), `GameList`.
- `assets/src/features/tour/` + `assets/src/app/HelpMenu.tsx` — the guided
  tour: a hand-rolled spotlight (a ring whose box-shadow dims the page) and
  tooltip stepping through `data-tour` landmarks; steps that don't resolve
  are skipped. Room-only (the landing page doesn't need one), started from
  the app-bar help menu, which also houses the keyboard-shortcuts dialog.
- `assets/src/features/analysis/` — the board: hand-rolled `Board.tsx`
  (keyboard-playable squares, drag, arrows, highlights, roles), `Analysis`
  (the orchestrator: all viewer state, derived data and interaction
  handlers — navigation, comments, present/follow, engine toggles, the
  whole-game analyze job), with the three screen regions as pure
  presentation components: `BoardColumn.tsx` (title row, board, eval bar,
  edit palettes, nav, comments, board controls), `AnalysisSidebar.tsx`
  (Moves | Game info | Openings | Examples tabs plus the `VizBox`
  moments/report tabs), and `TimelineBand.tsx`. `legalMoves.ts`
  (client-side legal moves + resulting fen/status via chess.js — no
  server round trip), `moveList.ts`/`MoveList.tsx`
  (variation tree), `nodeMap.ts` (ply ↔ node index), `BoardControls`,
  `GameInfo`, `NodeComment`. Whole-game visualization (ADR-0024, as
  amended 2026-08-24) splits by kind: `TimelineBand.tsx` is the full-width
  band under the board where the game-story charts stack as toggleable
  layers on one shared move axis (`spanPly` = mainline tip; layer choice
  is a localStorage preference) — `GameFlow` (eval + quality strip, phase
  shading and capture marks via `gamePhases.ts`/`MaterialFlow.capturesOf`),
  `MaterialFlow`, `ActivityFlow`, and `ClocksFlow` (thinking time per move
  from `node.clock` — the parser extracts `[%clk …]` comments into a
  first-class field at import, so clock data never pollutes comments; the
  Lichess game export requests `clocks=true`, and `moveTimes.ts` derives
  per-move think time from the clock drops plus the `TimeControl`
  increment). The band header owns the whole-game analyze job's
  lifecycle — "Analyze game" before any evals, live progress, and
  "Re-analyze" when the mainline outgrew it — so a chip toggle never
  gates the only path to an analysis; the eval chip wears a gold marker
  until a job has run. The engine box keeps only its line-scoped
  "Analyze line" action. The sidebar viz box keeps the list views
  (`CriticalMoments`, `GameReport`).
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
  The same book backs the **Openings tab** (`ReferencePanel.tsx`,
  ADR-0024): `continuationsFor` lists the named book moves of the cursor
  position; hovering a row previews the move as a ghost arrow (local), and
  clicking it plays the move as a real broadcast op — the panel's
  re-anchor on cursor move makes the descent free. Corpus statistics
  upgrade the rows post-spike.
- `assets/src/features/historicalEvidence/` — the vertical slice's UI: the
  **Examples** sidebar tab runs `POST /api/historical-evidence` for the
  board cursor (with the game's own move order as the route) and renders
  evidence cards — position dims, route divergence, per-side plan
  membership, appearance/game counts, flags. Facts only (ADR-0027). Card
  actions report their outcome and de-duplicate: "Add to room" sends a
  `set_game` op without switching the room's view (the game appears in
  the Games panel; a presenting adder re-points the room via
  `select_game` back to the viewed game, because the presenter's own
  `set_game` counts as focus), records the candidate ply in `openAtPly`
  so the game opens at the candidate's move (`Analysis.initialNodeId` →
  `useCursor`'s init order: `startAtRoot` → last played → initial node →
  mainline tip), and the button flips to "Added ✓" once fetched. "Add as
  variation" shows "Adding…" until the echo lands in the tree, then
  "Added ✓" — the exists state is derived from the tree itself
  (`variationState` in `Analysis`, plan-identical to the insertion via
  `planHistoricalVariation` + the same from/to/promotion chain descent
  `applyAddLine` uses), so it can never disagree with reality.
- `SidebarTabs` keeps every tab's content mounted and hides inactive
  panels (`hidden` attr + class): the Examples results survive tab
  switches; state-preserving by contract, tested with a counter.
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
