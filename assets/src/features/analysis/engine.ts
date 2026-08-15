/**
 * In-browser Stockfish UCI client, backed by a single classic Web Worker.
 *
 * The worker script and its wasm are served verbatim from `/engine/` (see
 * `assets/scripts/copy-engine.mjs`): the stockfish.js build locates its wasm
 * by replacing `.js` with `.wasm` in the worker script's own URL, so the two
 * files must share a path stem — Vite's content-hashed asset URLs break that
 * convention, which is why they are copied to stable names instead.
 *
 * `analyze` is tokenized: starting a new search makes any in-flight one
 * stale, and callers must abort the previous search before starting the next
 * (the `useEngine` hook does exactly that).
 */
import {
  type InfoLine,
  type InfoScore,
  parseBestMove,
  parseInfoLine,
} from '@/features/analysis/uci';

const STOCKFISH_WORKER_URL = '/engine/stockfish-18-lite-single.js';

export type EngineLine = {
  score: InfoScore;
  depth: number;
  /** Win/draw/loss per mille from the side to move, when the engine emits it. */
  wdl: { win: number; draw: number; loss: number } | null;
  pv: string[];
};

export type EngineResult = {
  score: InfoScore;
  depth: number;
  pv: string[];
  bestMove: string;
  /** Every MultiPV line, best first (rank 1 is mirrored in score/pv above). */
  lines: EngineLine[];
};

/** How many lines the engine reports per position (lichess default: 3). */
const MULTI_PV = 3;

export type WorkerLike = {
  postMessage(message: string): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror?: ((event: { message?: string }) => void) | null;
  terminate(): void;
};

export interface ChessEngine {
  /** Runs the UCI handshake once; retried after a failure. */
  init(): Promise<void>;
  analyze(
    fen: string,
    options: { movetimeMs: number },
    signal: AbortSignal,
  ): Promise<EngineResult | null>;
  terminate(): void;
  /** True once the worker died fatally (script/wasm/exception) — it will never answer again. */
  hasFailed?(): boolean;
  /** Changes the MultiPV line count for subsequent searches. */
  setMultiPV?(count: number): void;
}

function abortError(): DOMException {
  return new DOMException('Engine search aborted', 'AbortError');
}
export function createStockfishEngine(workerFactory?: () => WorkerLike): ChessEngine {
  const worker: WorkerLike =
    workerFactory !== undefined
      ? workerFactory()
      : (new Worker(STOCKFISH_WORKER_URL) as unknown as WorkerLike);
  let listeners: Array<(line: string) => void> = [];
  let fatal: Error | null = null;
  const fatalListeners = new Set<(error: Error) => void>();

  function failFatally(error: Error) {
    fatal ??= error;
    for (const listener of [...fatalListeners]) {
      listener(fatal);
    }
  }

  // A worker-level failure (script 404, wasm compile error, uncaught
  // exception in the engine) never produces output — surface it immediately
  // instead of letting handshakes time out.
  worker.onerror = (event) => {
    failFatally(new Error(event.message ?? 'engine worker failed to start'));
  };

  worker.onmessage = (event) => {
    const text = String(event.data ?? '');
    for (const line of text.split('\n')) {
      if (line.trim() === '') {
        continue;
      }
      for (const listener of [...listeners]) {
        listener(line);
      }
    }
  };

  function onLine(listener: (line: string) => void): () => void {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((entry) => entry !== listener);
    };
  }

  function onFatal(listener: (error: Error) => void): () => void {
    fatalListeners.add(listener);
    return () => fatalListeners.delete(listener);
  }

  function waitForLine(predicate: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (fatal !== null) {
        reject(fatal);
        return;
      }
      const timer = setTimeout(() => {
        off();
        reject(new Error('engine handshake timed out'));
      }, timeoutMs);
      const offFatal = onFatal((error) => {
        clearTimeout(timer);
        off();
        reject(error);
      });
      const off = onLine((line) => {
        if (predicate(line)) {
          clearTimeout(timer);
          offFatal();
          off();
          resolve(line);
        }
      });
    });
  }

  let initialized: Promise<void> | null = null;

  function initialize(): Promise<void> {
    initialized ??= (async () => {
      try {
        worker.postMessage('uci');
        await waitForLine((line) => line === 'uciok', 30_000);
        worker.postMessage(`setoption name MultiPV value ${MULTI_PV}`);
        // The lite build keeps WDL off by default; we want it for the box.
        worker.postMessage('setoption name UCI_ShowWDL value true');
        worker.postMessage('isready');
        await waitForLine((line) => line === 'readyok', 30_000);
      } catch (error) {
        // A failed handshake (timeout, hiccup) may be retried; a fatal
        // worker error stays fatal — `hasFailed()` reports that.
        initialized = null;
        throw error;
      }
    })();
    return initialized;
  }

  let currentSearch = 0;
  let cancelCurrentSearch: (() => void) | null = null;

  async function analyze(
    fen: string,
    { movetimeMs }: { movetimeMs: number },
    signal: AbortSignal,
  ): Promise<EngineResult | null> {
    await initialize();
    if (signal.aborted) {
      throw abortError();
    }

    // A new search supersedes any in-flight one: stop it and drop its
    // listener even when the caller forgot to abort it first.
    cancelCurrentSearch?.();

    const search = ++currentSearch;
    /** The latest info line per MultiPV rank (rank 1 = the best line). */
    const latestByRank = new Map<number, InfoLine>();
    let bestMove: string | null = null;

    return new Promise((resolve, reject) => {
      const off = onLine((line) => {
        if (search !== currentSearch) {
          return;
        }
        const info = parseInfoLine(line);
        if (info !== null) {
          if (info.depth !== null && info.score !== null) {
            latestByRank.set(info.multipv ?? 1, info);
          }
          return;
        }
        const move = parseBestMove(line);
        if (move !== null) {
          bestMove = move;
          off();
          signal.removeEventListener('abort', onAbort);
          if (cancelCurrentSearch === onAbort) {
            cancelCurrentSearch = null;
          }
          if (search !== currentSearch) {
            return;
          }
          const lines = [...latestByRank.entries()]
            .sort(([a], [b]) => a - b)
            .filter((entry): entry is [number, InfoLine & { score: InfoScore }] => {
              const [, info] = entry;
              return info.score !== null;
            })
            .map(([, info]) => ({
              score: info.score,
              depth: info.depth ?? 0,
              wdl: info.wdl,
              pv: info.pv,
            }));
          const best = lines[0];
          if (best !== undefined) {
            resolve({
              score: best.score,
              depth: best.depth,
              pv: best.pv,
              bestMove,
              lines,
            });
          } else {
            resolve(null);
          }
        }
      });

      const onAbort = () => {
        off();
        if (cancelCurrentSearch === onAbort) {
          cancelCurrentSearch = null;
        }
        worker.postMessage('stop');
        reject(abortError());
      };
      cancelCurrentSearch = onAbort;
      signal.addEventListener('abort', onAbort, { once: true });

      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go movetime ${movetimeMs}`);
    });
  }

  return {
    init: initialize,
    analyze,
    terminate() {
      worker.terminate();
    },
    hasFailed() {
      return fatal !== null;
    },
    setMultiPV(count: number) {
      worker.postMessage(`setoption name MultiPV value ${count}`);
    },
  };
}

let shared: ChessEngine | null = null;

export function getSharedEngine(): ChessEngine {
  // A fatally failed worker can never answer again — replace it, so the UI's
  // retry path actually recovers.
  if (shared !== null && shared.hasFailed?.() === true) {
    shared.terminate();
    shared = null;
  }
  shared ??= createStockfishEngine();
  return shared;
}
