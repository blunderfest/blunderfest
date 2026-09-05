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
    `persisted?/1`, `read_only?/1`, `approval_status/3`. The op log is the
    room's authoritative state (ADR-0005); joins never create rooms
    (ADR-0006) — except that a room with durable rows (ADR-0028) revives:
    the join gate admits it, the process starts, and its init loads the
    log back. Ops are stored prepended with a counter (O(1) append).
    Rooms created `read_only: true` record no members and allow no edits.
  - `RoomLog` (GenServer, ADR-0028) — the durable mirror of rooms' op
    logs: every non-cursor op is written through (with an `author_name`
    snapshot) as the room appends it, roles are persisted on change, and
    a starting room loads its log, roles, and activity time back. Rows
    live in the existing Fly Postgres (ADR-0026), two tables
    (`room_logs`, `room_ops`) behind this boundary via Postgrex — no
    Ecto. Purge paths: eviction deletes the rows with the room, and the
    room sweeper's backstop removes rows idle past the 1h threshold with
    no live process cluster-wide. Unconfigured (no `db:`), it is inert —
    rooms stay memory-only.
  - `DemoRoom` — the read-only demo room at the reserved code `chess`
    (ADR-0014): a fixed annotated game, seeded on demand when a channel join
    targets the code (so it survives room-process and node loss). The create
    endpoint rejects the reserved code with `code_reserved`.
  - `Repo` + `RepoMigrations` (ADR-0029): the application-data repository —
    `profiles`, `accounts`, `library_entries` tables behind Ecto, with
    boot-time, advisory-locked migrations (deploys self-migrate). The
    corpus and the room log keep their Postgrex-direct boundaries; only
    these three entity sets use Ecto.
  - `Profiles` (ADR-0004, durable since ADR-0029): anonymous profiles
    with salted device-secret hashes (one per device), `authenticate/2`,
    fun-name generation, linked external **accounts** (lichess username
    + OAuth token, ADR-0022) and `issue_secret/1` for cross-device
    recovery. Ecto-backed: one profile per device secret cluster-wide —
    the two-region split-brain of the in-memory predecessor is gone.
  - `Library` (ADR-0020, durable since ADR-0029): per-profile saved game
    trees in `library_entries` — the library finally crosses devices.
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
- `lib/blunderfest/corpus/` — the corpus boundary (ADR-0026, ADR-0027,
  ADR-0037); application code never sees its internals:
  - `corpus.ex` — the facade GenServer: owns the Postgrex pool and
    delegates every query; starts unconfigured (inert) when no `db:`
    config exists, e.g. dev without `DATABASE_URL`. It serializes every
    corpus read through one process — the replaceability seam (ADR-0026);
    the occurrence backend is configured (`:postgres` or `:packed`) and
    nothing downstream notices (Spike 08/ADR-0037).
  - `packed/` — the packed occurrence backend (Spike 08/ADR-0037):
    `packed/format.ex` (fixed-width records: occ 22B, pos header + strings
    region, bucket 24B, book 22B header + variable blob),
    `packed/builder.ex` (sortedness + size + SHA-256 validation per
    segment), `packed/manifest.ex` (manifest read/write/all-or-nothing
    validation), `packed/segment.ex` (sparse anchors — binary search
    anchors → bounded chunk scans; ~17 MB anchors at stride 256 for the
    broadcast corpus, persisted as `<file>.anchors-<stride>` sidecars next
    to the bins and loaded at open — a missing/corrupt sidecar falls back
    to a chunked sequential rebuild and re-persists, so boots cost
    milliseconds instead of the old 1.21M-pread walk; Spike 09 Phase 1),
    `packed/input.ex` (8 MB chunk line reader — the
    build path bottleneck), `packed.ex` (segments merged in build order).
    Opens per query in the calling process — the raw fd never crosses
    process boundaries. **Format v2** (Spike 09 Phase 2, ADR-0038):
    `mix corpus.pack --format-version 2` writes 49-byte pos headers that
    additionally carry the pack-time run statistics — `occurrence_count`,
    `game_count`, `occ_run_offset` — under a `"version": 2` manifest with a
    per-segment `pos_version`; open serves v1 and v2 alike and rejects
    unknown versions. The builder verifies the stored statistics against
    occ.bin on a sampled pass before publish; `Segment.position_stats/2` /
    `Packed.position_stats/2` read them and `Segment.verify_run/2`
    re-checks them — consumed by `corpus.validate`/`corpus.parity` only
    (no product cutover yet).
  - `position_key.ex` — canonical position identity (Spike 01): the
    capturable-only en-passant convention, 128-bit BLAKE2b hashes.
  - `replay.ex` + `extraction.ex` — lean mainline replay and the streaming
    PGN → occ/games/moves/keys artifact pipeline (mix `corpus.extract`).
  - `occurrences.ex` — the PG store: COPY-loaded, UNLOGGED, rebuildable
    (mix `corpus.load`); positions carry the 63-bit pawn bucket hash.
  - `book.ex` — PG aggregate (SQL). In packed mode the facade routes
    `:book` to the precomputed `book.bin` aggregate (built at pack time
    from the gid-major merge of occurrences + moves + results), never the
    per-occurrence fan-out. `ORDER BY move` runs in C collation — the
    sorted-by-bytes contract the packed backend depends on (Spike 08 fix).
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
(`mix corpus.extract` → `corpus.load` for PG, or → `corpus.pack` +
`corpus.validate` for the packed segments; `corpus.pack` and the parity
check the PG artifact pipeline and the packed build both come from the same extraction artifacts, so PG vs
packed is a config flip). `DATABASE_URL` is a deployed secret parsed in
`config/runtime.exs`. The spike 08 benchmarks/parity are in
`mix corpus.bench` / `corpus.parity` / `corpus.he_parity`.

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
payloads (`move_at_ply` (also carries pass/null-moves: san `'--'` with
`from/to: nil`, created on a drag/tap that fails on the side-to-move but
matches once flipped — ADR-0033), `add_line` (a whole line in one op — engine lines
become variations atomically), `comment_at_ply`, `set_nags`, `set_game`,
`rename_game` (a game title stored on the tree's custom `Title` header —
exports carry it), `select_game`, `set_cursor`, `set_role`, `chat` (room
chat — replay is the
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
- `assets/src/store/roomStore.ts` — the room store, an `@xstate/store`: the
  `Op` union is its event type, so ops are sent directly
  (`store.send(op)`) rather than wrapped in adapter actions; join-time replay
  folds the log through the same `store.transition` used live, so replay and
  live apply share one code path. One store per room (`createRoomStore`),
  holding the op-log projection (games, annotations, analysis, lastPlayed)
  plus ephemeral UI state (presence, roles, regions, lag, presenter) in a
  single context, so every read observes one coherent snapshot. Selectors
  (`selectFirstGameId`, `selectPresenterGameId`, …) read the context;
  allocating ones (`selectSortedMembers`, `selectEvidenceGids`) are memoized
  for a stable reference (the store hook compares selected values with `===`).
- `assets/src/store/roomContext.ts` — the React bindings: `RoomStoreProvider`
  (the per-room store, injected so tests/concurrent rooms never share state)
  and `useRoomSelector` for reads. The channel (`useRoomChannel`) is the only
  writer — components never send events.
- `assets/src/features/room/` — `RoomView` (layout, join/not-found states,
  the games rail's handlers, the chat unread count, per-game cursor memory),
  `GameRail` (the games rail, ADR-0032: chrome — fixed "Boards · N" header
  with the import/new icons, a self-scrolling list of text rows (title +
  opening + a presenter-initials marker), a "position" chip for setup games;
  vertical rail on desktop, horizontal strip on mobile), `RegionChip` (the
  app bar's connection telemetry: server region + room region + measured
  RTT, tooltip with the full sentence; renders nothing until the join reply
  supplies a region), `useRoomChannel` (join, op/role handling,
  `sendOp`/`sendRole`, 10s ping loop → `lagMs`; events from superseded
  channels are ignored; presence is synced through phoenix's `Presence`
  helper — meta-level diffing by `phx_ref`, so one member's two tabs don't
  evict each other — and lands in the store as a wholesale `syncMembers`
  replace), `PresenceStrip` (the app-bar avatar strip + popover with follow /
  presenter handoff / role management — presence is chrome, ADR-0031),
  `ShareButton`'s successor `RoomCodeChip` (the app bar's mono room code —
  click copies the code; read-only rooms wear the demo badge on it;
  leaving the room is the logo, ADR-0032), `ChatPanel` (the Chat tab; the
  unread badge count lives in `RoomView`, which also owns the active tab so
  it survives game switches).
  `RoomView` keeps a per-game cursor memory (`cursorByGame`, fed by
  Analysis' `onLocalCursor` — every local cursor change, presenter or
  not): Analysis unmounts on each game switch, so without it a switch
  back would reopen the game at the tail; the stored node feeds
  `initialNodeId` (after `openAtPly` for added historical games). The
  memory is local — cursors are per-viewer state, never broadcast or
  stored. The store also tracks `lastPlayedBy` (who played last per
  game): `useCursor`'s follow-the-tail reacts only to the
  `remoteLastPlayedId` derived from it, so a viewer's own variation
  inserts never yank the cursor off the position being analyzed, while
  other members' moves still carry the game along.
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
  presentation components: `BoardColumn.tsx` (title row (game-level
  actions: export/save), board, eval bar, edit palettes, one toolbar —
  nav plus direct icons: flip, comment, Find examples (per-position),
  edit position, drawing-color dots, clear — comments),
  `AnalysisSidebar.tsx`
  (the room's one tabbed column, ADR-0031 as amended by ADR-0032: Moves |
  Review | Chat — Moves = engine box pinned atop the opening-book
  reference block (ADR-0024 as amended) + the move list; Review nests
  Moments | Report | Game info; Chat content arrives pre-built from
  RoomView; the active tab is lifted to RoomView), and `TimelineBand.tsx`. `legalMoves.ts`
  (client-side legal moves + resulting fen/status via chess.js — no
  server round trip), `moveList.ts`/`MoveList.tsx`
  (variation tree), `nodeMap.ts` (ply ↔ node index), `BoardControls` (the
  toolbar's direct action icons — flip, comment, find examples, edit
  position, the drawing-color dots, clear), `GameInfo`, `NodeComment`.
  Whole-game visualization (ADR-0024, as amended 2026-08-24; ADR-0031;
  tabbed and docked per ADR-0034)
  splits by kind: `TimelineBand.tsx` is a fixed-height bottom region of the
  board column (the rail and dock run the full viewport height beside it; the
  strip is **not collapsible**). It shows **one chart at a time**, switched by
  a tab row in the strip header (Eval · Material · Activity · Clocks) with the
  same accent-underline grammar as the dock tabs. All charts share one move
  axis (`spanPly` = mainline tip); the active layer is a localStorage
  preference (`blunderfest.timelineActiveLayer`) —
  `GameFlow` (eval + quality strip, phase
  shading and capture marks via `gamePhases.ts`/`MaterialFlow.capturesOf`),
  `MaterialFlow`, `ActivityFlow`, and `ClocksFlow` (thinking time per move
  from `node.clock` — the parser extracts `[%clk …]` comments into a
  first-class field at import, so clock data never pollutes comments; the
  Lichess game export requests `clocks=true`, and `moveTimes.ts` derives
  per-move think time from the clock drops plus the `TimeControl`
  increment). The band header owns the whole-game analyze job's
  lifecycle — "Analyze game" before any evals, live progress, and
  "Re-analyze" when the mainline outgrew it — reachable in both band
  states; the eval chip wears a gold marker
  until a job has run. The engine box keeps only its line-scoped
  "Analyze line" action. The Review tab keeps the list views
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
  position, each with its corpus game count + W/D/B rate bar
  (`GET /api/book?fen=…`); hovering a row previews the move as a ghost
  arrow (local), and clicking it plays the move as a real broadcast op —
  the panel's re-anchor on cursor move makes the descent free. The stats
  fetch is explicit about its state (ADR-0035): a pulsing "Loading corpus
  statistics…" header + per-row skeleton while `/api/book` is in flight, a
  red error line on failure. The stats are aggregated in SQL (one grouped
  query, one row per `(move, result)`, no per-occurrence BEAM round-trip)
  and the endpoint sends `Cache-Control: private, max-age=86400` — a
  position's stats are content-addressed by its FEN.
- `assets/src/features/analysis/PositionContext.tsx` — the positional-
  context panel (ADR-0024 as amended). An explicit resolution order:
  tablebase-eligible (a label; no source yet) → in-book (the ReferencePanel)
  → one-ply transposition back into book (local child-position check against
  the book + one batched `POST /api/book/counts` for the candidates'
  independent-game support; the rows are interactive like the book rows) →
  likely-endgame → cached evidence summary + View → the find-CTA. The phase
  model (`phaseOf` in `gamePhases.ts`: material/24 with pawns counted,
  `tablebaseEligible` ≤ 7 pieces, `likelyEndgame` ≤ 0.5) is shared with the
  eval chart's endgame shading (`endgameStart`). The start position counts
  as in the book by definition (the openings corpus never keys it), and
  since the ply-0 extraction it has corpus occurrences too — the start
  position's first moves get real W/D/B stats like any other book position.
  The evidence summary counts the candidates the
  View dialog will list (the analyzed game itself filtered out), not the
  reference position's exact-match games: an off-book position has 0 exact
  games yet can still surface a full list of similar examples.
- `assets/src/features/historicalEvidence/` — the vertical slice's UI
  (ADR-0027, ADR-0030): the board header's **Find examples** button
  (next to Export PGN / Save to library — editors only; the old
  Examples sidebar tab is gone) opens `HistoricalEvidenceDialog`, a
  modal carousel over the candidates for the cursor's position. The
  query (`POST /api/historical-evidence`, with the game's own move
  order as the route) runs **privately** on open — no channel traffic —
  and renders one slide per candidate: a static board at the candidate
  position plus the facts card (position dims, route divergence,
  per-side plan membership, appearance/game counts, flags; facts only
  per ADR-0027). Prev/next (buttons, ←/→ keys), "i of n" counter,
  Esc/backdrop close. Finished analyses are remembered per request
  (position + route + ply) in the `evidenceCache.ts` session cache, so
  reopening the dialog for the same position never re-runs the query.
  Candidates that ARE the analyzed game (the corpus may contain an
  imported game) are filtered out via the PGN headers. The card
  headline claims "same position" only when the placement AND side to
  move match: one piece moved plus a tempo flip means the candidate is
  a half-move off, and the headline names the move instead
  (route-aware: "played Nge7" / "one move before"). Only picks are
  shared with the room, as ordinary ops (ADR-0030): "Add to room"
  sends a `set_game` op without switching the room's view (the game
  appears in the Games panel; a presenting adder re-points the room via
  `select_game` back to the viewed game, because the presenter's own
  `set_game` counts as focus), records the candidate ply in `openAtPly`
  so the game opens at the candidate's move (`Analysis.initialNodeId` →
  `useCursor`'s init order: `startAtRoot` → initial node → last played →
  mainline tip — the viewed position wins over the last played move on
  a game switch; a refresh has no memory, so the last played move then
  decides). The `set_game` op carries the corpus `evidence_gid`, so
  every client derives which candidates are already in the room from
  the op log (`selectEvidenceGids`) — "Added ✓" agrees across the room;
  RoomView dedupes by PGN fingerprint before sending, so a game already
  in the room (imported, or added earlier) never produces a duplicate
  op (with a local mark for the clicking client). Picks never
  auto-advance the carousel — the button flips and the user browses on.
  "Add as variation" shows "Adding…" until the echo lands in the tree,
  then "Added ✓" — the exists state is derived from the tree itself
  (`variationState` in `Analysis`, plan-identical to the insertion via
  `planHistoricalVariation` + the same from/to/promotion chain descent
  `applyAddLine` uses), so it can never disagree with reality; the SAN
  resolution behind it is cached module-wide and warmed during the
  corpus query. A future in-game move browser inside the dialog is a
  noted follow-up.
- `SidebarTabs` keeps every tab's content mounted and hides inactive
  panels (`hidden` attr + class): tab state survives switches;
  state-preserving by contract, tested with a counter. Uncontrolled by
  default; controlled via `activeId`/`onActivate` when the parent owns the
  active tab (the room sidebar, for the chat badge + game-switch
  survival). Tabs accept a `badge` (the chat unread count).
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
2. `useRoomChannel` joins `room:<slug>` and creates the room's store; the
   server replies `{ops, roles}` — the ops replay into the store
   (`room.replayed`, folding the log through the same transition used live);
   presence syncs the member list (phoenix `Presence` → `members.synced`).
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
