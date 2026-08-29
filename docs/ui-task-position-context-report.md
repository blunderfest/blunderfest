# Position context — implementation report

UI task `docs/ui-task-contextual-position-context-panel.md`, implemented
2026-08-29. The panel is the Moves tab's third block (Engine, MoveList,
Positional context); OPENINGS folds inside it.

## Existing architecture (before)

- **Opening Book** — `ReferencePanel` (ADR-0024's tab): `continuationsFor`
  reads the static book (`openings.json`, 3809 positions; the position key
  is placement + side + castling so transpositions match). It renders a
  "OPENINGS" section in the Moves tab; hovering a row previews a ghost
  arrow (local), clicking plays the move (real op).
- **Historical Evidence** — `analyzeHistoricalEvidence` (`lib/api.ts`)
  issues `POST /api/historical-evidence` with `fen` and optional `route` /
  `refPly`. `Analysis.tsx`'s `openFindExamples` captures a frozen request
  on open; the dialog's own effect runs the query once (privately, never
  on channel traffic) and caches finished results in
  `features/historicalEvidence/evidenceCache.ts` (`RESULT_CACHE` keyed on
  `JSON.stringify([fen, route, refPly])`, LRU 20).
- **Cursor propagation** — `useCursor` (driving `Analysis`) re-derives
  `current` from the tree on every change, so `current.fen`/`current.ply`
  always match the board position.

## Implementation

- **Moves order:** EngineBox → MoveList → PositionContext. The
  `ReferencePanel` moves inside `PositionContext` when the book has data,
  so opening rows stay.
- **State union (small, explicit):** a single explicit switch renders one
  of `{Opening book | Historical evidence (cached summary plus View) |
  Find (CTA) | Failed (retry)}`. A tablebase variant is the extension
  seam documented below — the union just needs a new first branch.
- **Cached summary:** `cachedResult(requestKey(...))` is read
  synchronously on every render. The CTA calls `runFindEvidence` (owned
  by `Analysis.tsx` — it runs the query, `rememberResult`s it, and warms
  the resolved-line cache like the dialog does). On promise resolution a
  local `resolved` state updates (so the render sees the cache write
  without a custom pub/sub).
- **View evidence:** the summary's View button opens the existing dialog
  (`openFindExamples`) — the same frozen request, so it's an instant
  cache hit rather than a re-run.
- **Staleness:** a render-time `previousFen` compare resets the local
  resolution and the CTA state on any cursor change; the previous
  position's state is discarded, never "stale-guarded."

## Opening Book cutoff

**Rule:** `continuationsFor(book, fen).length === 0` → the position is
not available from book. It's computed on every render from `current.fen`
plus the static book — no move-number heuristic, and the book's position
keys (placement + side + castling) mean "available" literally.

## Historical Evidence lifecycle

`runFindEvidence` → `rememberResult(requestKey(fen, route, refPly), result)`
→ `cachedResult(requestKey(...))` on every render — one cache, one key
shape, one interpretation of data, shared by the panel and the dialog.

## Position safety

`previousFen` compares the current cursor's FEN to the one the panel last
resolved; any change nulls `resolved` and returns the CTA to idle. A
stale promise never overwrites the live position's state — the resolution
carries through `RESULT_CACHE` and the visible summary reflects
the current position's lookup on every render.

## Tablebase extension point

The state union's first slot is a documented seam: when a TB source
exists, a new `tablebase` branch above the book/eval branches uses the
same render-and-reset pattern. No TB source exists in the repo; only the
reserved seam, no provider or WDL/DTZ logic.

## Known limitations

- The summary is purely informational (no ranking/eval) per §21 — it
  inherits every limitation of the `evidence.next_moves` field, and any
  numbers showing "quality" are counted occurrences only.
- The panel inherits existing limits of the experiment's line-resolution
  cache (module-wide, LRU) and the session `RESULT_CACHE` (LRU 20) —
  a user's overwrite: positions sequentially exceed 20 cached
  entries, the re-run re-fetches.
