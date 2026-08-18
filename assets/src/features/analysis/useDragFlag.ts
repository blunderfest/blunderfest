import { useCallback, useEffect, useRef, useState } from 'react';
import { type ChessEngine, createStockfishEngine } from '@/features/analysis/engine';
import { type MoveMark, markForLoss, whiteEvalToCp } from '@/features/analysis/evalMarks';
import { type WhiteEval, whiteEval } from '@/features/analysis/uci';
import type { LegalMove } from '@/lib/api';

export type DragFlag = { square: string; mark: MoveMark };

const DEBOUNCE_MS = 120;
const SEARCH_MS = 100;

/**
 * Live "is this move a blunder?" while dragging (the milestone-4 engine
 * scope): the candidate move gets a quick search on a *dedicated* engine
 * instance (the main analysis keeps running), and the loss against the
 * main analysis' eval of the current position becomes a flag on the
 * hovered square — the move list's own thresholds, so a flag never
 * disagrees with a mark. Editors only; nothing is broadcast (the engine
 * is per-viewer). A fixed-depth caveat: baseline and candidate come from
 * different searches, so borderline noise is possible — the 75cp floor
 * absorbs it.
 *
 * `engine: undefined` creates the real Stockfish worker lazily on the
 * first hover; `null` disables (tests, worker-less environments).
 */
export function useDragFlag({
  enabled,
  currentFen,
  currentEval,
  legalMoves,
  engine,
}: {
  /** Engine on, a playable position, not editing. */
  enabled: boolean;
  /** The cursor position (the move's "before"). */
  currentFen: string | null;
  /** The main analysis' eval of currentFen — the baseline (null = not ready). */
  currentEval: WhiteEval | null;
  legalMoves: LegalMove[] | null;
  engine?: ChessEngine | null;
}): { flag: DragFlag | null; onDragHover: (from: string, to: string | null) => void } {
  const [flag, setFlag] = useState<DragFlag | null>(null);
  const engineRef = useRef<ChessEngine | null>(null);
  const debounceRef = useRef<number | null>(null);
  const searchRef = useRef<AbortController | null>(null);

  const cancelPending = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    searchRef.current?.abort();
    searchRef.current = null;
  }, []);

  // A new position or a disabled flag clears everything.
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentFen/enabled are the triggers, not referenced values
  useEffect(() => {
    setFlag(null);
    cancelPending();
  }, [currentFen, enabled, cancelPending]);

  // The dedicated worker dies with the component.
  useEffect(
    () => () => {
      engineRef.current?.terminate();
    },
    [],
  );

  const onDragHover = useCallback(
    (from: string, to: string | null) => {
      cancelPending();
      setFlag(null);
      if (!enabled || to === null || currentFen === null) {
        return;
      }
      // The baseline: no flag until the main analysis has one.
      if (currentEval === null) {
        return;
      }
      const evalBefore = whiteEvalToCp(currentEval);
      // Promotions: the queen represents the cluster.
      const candidate =
        legalMoves?.find((m) => m.from === from && m.to === to && m.promotion === 'q') ??
        legalMoves?.find((m) => m.from === from && m.to === to);
      if (candidate === undefined) {
        return;
      }
      if (engine === null || (engine === undefined && typeof Worker === 'undefined')) {
        return;
      }
      const moverIsWhite = currentFen.split(' ')[1] === 'w';

      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        if (engineRef.current === null) {
          engineRef.current = engine ?? createStockfishEngine();
          // A single line is enough (and faster) for a flag search.
          engineRef.current.setMultiPV?.(1);
        }
        const dragEngine = engineRef.current;
        const controller = new AbortController();
        searchRef.current = controller;
        dragEngine
          .analyze(candidate.fen, { movetimeMs: SEARCH_MS }, controller.signal)
          .then((result) => {
            if (controller.signal.aborted || result === null) {
              return;
            }
            const sideToMove = candidate.fen.split(' ')[1] === 'b' ? 'b' : 'w';
            const evalAfter = whiteEvalToCp(whiteEval(result.score, sideToMove));
            const loss = moverIsWhite ? evalBefore - evalAfter : evalAfter - evalBefore;
            const mark = markForLoss(loss);
            setFlag(mark === null ? null : { square: to, mark });
          })
          .catch(() => {
            // Aborted or engine failure: no flag, never an error state.
          });
      }, DEBOUNCE_MS);
    },
    [enabled, currentFen, currentEval, legalMoves, engine, cancelPending],
  );

  return { flag, onDragHover };
}
