import { useEffect, useRef, useState } from 'react';
import { type ChessEngine, getSharedEngine } from '@/features/analysis/engine';
import { bestMoveSquares, type WhiteEval, whiteEval } from '@/features/analysis/uci';

export type EngineStatus = 'idle' | 'thinking' | 'ready' | 'error';

export type EngineState = {
  status: EngineStatus;
  eval: WhiteEval | null;
  bestMove: { from: string; to: string } | null;
  depth: number | null;
};

/**
 * Evaluates the position `fen` in the background and exposes the white-
 * perspective score plus the engine's best move.
 *
 * Analysis is debounced, and every new position aborts the previous search —
 * stale results are discarded. `engine: null` disables analysis (tests,
 * environments without workers); an explicit engine is used when given,
 * otherwise the shared singleton Stockfish engine.
 */
export function useEngine(
  fen: string | null,
  options: {
    engine?: ChessEngine | null;
    enabled?: boolean;
    movetimeMs?: number;
    debounceMs?: number;
  } = {},
): EngineState {
  const { enabled = true, movetimeMs = 250, debounceMs = 120 } = options;

  /**
   * Resolved on first use inside the effect, so the (expensive) engine is
   * never instantiated during render or when analysis is not visible.
   */
  const engineRef = useRef<ChessEngine | null>(null);

  const [state, setState] = useState<EngineState>({
    status: 'idle',
    eval: null,
    bestMove: null,
    depth: null,
  });

  useEffect(() => {
    /**
     * The engine is resolved inside the effect (never during render): an
     * explicit prop wins, otherwise the shared Stockfish singleton — or
     * nothing, in environments without workers (tests, SSR).
     */
    engineRef.current =
      options.engine !== undefined
        ? options.engine
        : typeof Worker === 'undefined'
          ? null
          : getSharedEngineLazy();

    if (!enabled || fen === null || engineRef.current === null) {
      setState({ status: 'idle', eval: null, bestMove: null, depth: null });
      return;
    }

    // Keep the previous result on screen while the new position is analyzed:
    // clearing it here would collapse the status line and flash the hint
    // arrow for a fraction of a second on every move.
    setState((previous) => ({ ...previous, status: 'thinking' }));
    const controller = new AbortController();
    const sideToMove: 'w' | 'b' = fen.split(' ')[1] === 'b' ? 'b' : 'w';

    const timer = window.setTimeout(() => {
      const engine = engineRef.current;
      if (engine === null) {
        return;
      }
      engine
        .analyze(fen, { movetimeMs }, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) {
            return;
          }
          if (result === null) {
            setState({ status: 'idle', eval: null, bestMove: null, depth: null });
            return;
          }
          setState({
            status: 'ready',
            eval: whiteEval(result.score, sideToMove),
            bestMove: bestMoveSquares(result.bestMove),
            depth: result.depth,
          });
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setState((previous) => ({ ...previous, status: 'error' }));
          }
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fen, enabled, movetimeMs, debounceMs, options.engine]);

  return state;
}

function getSharedEngineLazy(): ChessEngine | null {
  try {
    return getSharedEngine();
  } catch {
    return null;
  }
}
