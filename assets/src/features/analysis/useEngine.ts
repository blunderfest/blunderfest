import { useCallback, useEffect, useRef, useState } from 'react';
import { type ChessEngine, getSharedEngine } from '@/features/analysis/engine';
import { bestMoveSquares, type WhiteEval, whiteEval } from '@/features/analysis/uci';

export type EngineStatus = 'idle' | 'thinking' | 'ready' | 'error';

/** One engine line (MultiPV rank), white-perspective. */
export type EngineLineState = {
  eval: WhiteEval;
  depth: number;
  /** Win/draw/loss per mille from WHITE's perspective, when available. */
  wdl: { win: number; draw: number; loss: number } | null;
  pv: string[];
};

export type EngineState = {
  status: EngineStatus;
  eval: WhiteEval | null;
  bestMove: { from: string; to: string } | null;
  depth: number | null;
  pv: string[];
  /** Every MultiPV line, best first (empty until the first result lands). */
  lines: EngineLineState[];
  retry: () => void;
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
    /** The node's game status; terminal positions skip the engine. */
    positionStatus?: string;
    /** How many MultiPV lines to request (1–5); pushed to the engine live. */
    multiPv?: number;
  } = {},
): EngineState {
  const { enabled = true, movetimeMs = 250, debounceMs = 120 } = options;
  const positionStatus = options.positionStatus ?? 'active';

  /**
   * Resolved on first use inside the effect, so the (expensive) engine is
   * never instantiated during render or when analysis is not visible.
   */
  const engineRef = useRef<ChessEngine | null>(null);

  const [state, setState] = useState<Omit<EngineState, 'retry'>>({
    status: 'idle',
    eval: null,
    bestMove: null,
    depth: null,
    pv: [],
    lines: [],
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the effect on retry without being referenced inside
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

    engineRef.current?.setMultiPV?.(options.multiPv ?? 3);

    if (!enabled || fen === null) {
      setState({ status: 'idle', eval: null, bestMove: null, depth: null, pv: [], lines: [] });
      return;
    }

    // Terminal positions need no engine: a mate bar reads 50/50 ("equal")
    // without one — show the outcome itself.
    if (positionStatus !== 'active') {
      const turn = fen.split(' ')[1];
      const result = positionStatus === 'checkmate' ? (turn === 'w' ? '0-1' : '1-0') : '1/2-1/2';
      setState({
        status: 'ready',
        eval: { type: 'result', result },
        bestMove: null,
        depth: null,
        pv: [],
        lines: [],
      });
      return;
    }

    if (engineRef.current === null) {
      setState({ status: 'idle', eval: null, bestMove: null, depth: null, pv: [], lines: [] });
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
            setState({
              status: 'idle',
              eval: null,
              bestMove: null,
              depth: null,
              pv: [],
              lines: [],
            });
            return;
          }
          const lines = result.lines.map((line) => ({
            eval: whiteEval(line.score, sideToMove),
            depth: line.depth,
            // WDL arrives from the side to move; swap win/loss for black.
            wdl:
              line.wdl === null
                ? null
                : sideToMove === 'w'
                  ? line.wdl
                  : { win: line.wdl.loss, draw: line.wdl.draw, loss: line.wdl.win },
            pv: line.pv,
          }));
          setState({
            status: 'ready',
            eval: whiteEval(result.score, sideToMove),
            bestMove: bestMoveSquares(result.bestMove),
            depth: result.depth,
            pv: result.pv,
            lines,
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
  }, [
    fen,
    enabled,
    movetimeMs,
    debounceMs,
    options.engine,
    options.multiPv,
    attempt,
    positionStatus,
  ]);

  return { ...state, retry };
}

function getSharedEngineLazy(): ChessEngine | null {
  try {
    return getSharedEngine();
  } catch {
    return null;
  }
}
