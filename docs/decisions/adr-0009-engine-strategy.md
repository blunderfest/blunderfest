# ADR-0009: Engine strategy — Stockfish WASM in the browser, server UCI pool for batch

Status: Accepted — implementation pending

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
