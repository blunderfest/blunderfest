# ADR-0009: Engine strategy — Stockfish WASM in the browser, server UCI pool for batch

Status: Accepted (2026-08-04) — interactive layer implemented (2026-08-06), batch pool implemented (2026-08-12)

## Context

The product needs engine analysis in two shapes: instant, interactive feedback
(eval bar, best-move hint, blunder flags while dragging) and heavy batch jobs
("analyze whole game" → per-ply evals → eval-curve chart). Multiplayer rooms
also need a consistent truth for evals, which means a single authoritative
source for batch results.

## Decision

Two layers:

| Layer | Mover | Purpose |
|---|---|---|
| Interactive | **Stockfish WASM in the browser** | instant eval bar, best-move hint, blunder flags while dragging — zero server round trip |
| Batch | **Server-side UCI worker pool** | "analyze whole game" jobs → per-ply evals stored → eval-curve chart; consistent truth for multiplayer |

The server pool is a supervised pool of N Stockfish binary processes speaking
UCI over Elixir ports, pipelined over a `:queue`. No mature hex package covers
this, so it ships as a self-contained `Blunderfest.Engine.Pool` module,
testable against a mock engine.

## Consequences

- Interactive analysis works offline and without server cost.
- Batch analysis results are durable per game and identical for all room
  members.
- Two analysis paths means two implementations to keep in sync on evaluation
  settings (depth, time, weights) — the eval-curve job should be the reference
  and the WASM layer should match its settings by default.
- The pool must handle process crashes (Supervisor restart) and backpressure
  (queue cap) before it can be relied on.

## Implementation notes (2026-08-06)

The interactive layer is implemented in the frontend:

- Engine: the `stockfish` npm package's **lite single-threaded WASM build**
  (`stockfish-18-lite-single`, ~7 MB wasm). The full build's 113 MB wasm is
  far too heavy for instant analysis, and the lite engine is still far
  stronger than any human (the package README recommends exactly this choice).
  Its postinstall script (a symlink convenience) is disabled in
  `pnpm-workspace.yaml`.
- Loading: the engine runs in a classic Web Worker constructed as
  `new Worker(<js-url>#<wasm-url>,worker)` — the stockfish.js build's own
  loading convention for locating its wasm. The URLs come from Vite `?url`
  imports, so hashed asset names stay in sync automatically. No CORS headers
  are needed (single-threaded).
- The UCI client (`assets/src/features/analysis/engine.ts`) exposes a
  `ChessEngine` interface (`init`/`analyze`/`terminate`) with tokenized
  searches: a new `analyze` makes any in-flight search stale, and callers
  abort the previous search before starting the next. `useEngine` debounces
  position changes (~120 ms), analyzes with `go movetime 250`, and converts
  UCI scores to a white-perspective eval.
- UI: `EvalBar` beside the board (white share mapped from centipawns, mates
  at the extremes) plus the engine's best move as an arrow overlay on the
  board (`Board`'s `arrows` prop, SVG in 8×8 space, flip-aware).
- Remaining from the original scope: blunder flags while dragging, and the
  server batch pool.

### Engine delivery (2026-08-06, second pass)

- The worker + wasm are served verbatim from `/engine/` as same-stem files
  (`scripts/copy-engine.mjs` copies them into `public/engine/`; Phoenix's
  `static_paths` includes `engine`). The stockfish.js glue locates its wasm by
  replacing `.js` with `.wasm` in the worker script URL, so Vite's
  content-hashed asset URLs break it in production — same-stem is the
  package's canonical layout (its postinstall creates the same symlinks).
- The client fails fast on worker-level errors (`worker.onerror`) instead of
  hanging until the handshake timeout.
- Verified working in Chromium and Firefox. (An earlier Firefox failure turned
  out to be the content-hashed wasm URL 404ing — the same-stem layout fixed
  all browsers at once.)

### Batch pool (2026-08-12)

- `Blunderfest.Engine.Worker` wraps one Stockfish binary per process (UCI
  over a Port, `:stream + {:line, 4096}`); `Blunderfest.Engine.Pool` keeps N
  workers with a FIFO queue and replaces crashed workers. A missing binary
  degrades to `:engine_unavailable`, never a crash. The binary is found via
  `STOCKFISH_PATH` or PATH (`stockfish` is installed in the release image).
- `Blunderfest.GameAnalysis` runs a whole-game job per room (one at a time;
  registered in the `AnalysisJobs` registry): mainline positions from the
  requesting client, evaluated at depth 12, progress broadcast transiently
  (`analysis_progress`), and the result appended as a `set_analysis` op —
  the op log keeps one truth, so joins replay it like anything else. Scores
  are stored in white's perspective.
- Client: editors get an "Analyze game" button in Game Info; the move list
  shows per-move evals and quality marks (`??`/`?`/`?!` at 300/150/75 cp
  swings). The activity feed notes completion.
- Tests use `test/support/fake_uci_engine.sh` (a canned UCI script) for the
  worker/pool, and the full channel→job→op cycle is covered in channel tests.
