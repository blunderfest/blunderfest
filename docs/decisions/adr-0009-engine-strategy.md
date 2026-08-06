# ADR-0009: Engine strategy — Stockfish WASM in the browser, server UCI pool for batch

Status: Accepted (2026-08-04) — interactive layer implemented (2026-08-06), batch pool pending

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
