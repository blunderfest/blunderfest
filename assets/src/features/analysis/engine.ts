/**
 * In-browser Stockfish UCI client, backed by a single classic Web Worker.
 *
 * The worker script is served as a static asset and is told where its .wasm
 * lives via the `#<wasm-url>,worker` hash — the loading convention of the
 * stockfish.js build. `analyze` is tokenized: starting a new search makes any
 * in-flight one stale, and callers must abort the previous search before
 * starting the next (the `useEngine` hook does exactly that).
 */
import stockfishWorkerUrl from 'stockfish/bin/stockfish-18-lite-single.js?url';
import stockfishWasmUrl from 'stockfish/bin/stockfish-18-lite-single.wasm?url';
import {
  type InfoLine,
  type InfoScore,
  parseBestMove,
  parseInfoLine,
} from '@/features/analysis/uci';

export type EngineResult = {
  score: InfoScore;
  depth: number;
  pv: string[];
  bestMove: string;
};

export type WorkerLike = {
  postMessage(message: string): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  terminate(): void;
};

export interface ChessEngine {
  /** Runs the UCI handshake once; idempotent. */
  init(): Promise<void>;
  analyze(
    fen: string,
    options: { movetimeMs: number },
    signal: AbortSignal,
  ): Promise<EngineResult | null>;
  terminate(): void;
}

function abortError(): DOMException {
  return new DOMException('Engine search aborted', 'AbortError');
}
export function createStockfishEngine(workerFactory?: () => WorkerLike): ChessEngine {
  const worker: WorkerLike =
    workerFactory !== undefined
      ? workerFactory()
      : (new Worker(`${stockfishWorkerUrl}#${stockfishWasmUrl},worker`) as unknown as WorkerLike);
  let listeners: Array<(line: string) => void> = [];

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

  function waitForLine(predicate: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('engine handshake timed out'));
      }, timeoutMs);
      const off = onLine((line) => {
        if (predicate(line)) {
          clearTimeout(timer);
          off();
          resolve(line);
        }
      });
    });
  }

  let initialized: Promise<void> | null = null;

  function initialize(): Promise<void> {
    initialized ??= (async () => {
      worker.postMessage('uci');
      await waitForLine((line) => line === 'uciok', 30_000);
      worker.postMessage('isready');
      await waitForLine((line) => line === 'readyok', 30_000);
    })();
    return initialized;
  }

  let currentSearch = 0;

  async function analyze(
    fen: string,
    { movetimeMs }: { movetimeMs: number },
    signal: AbortSignal,
  ): Promise<EngineResult | null> {
    await initialize();
    if (signal.aborted) {
      throw abortError();
    }

    const search = ++currentSearch;
    let latest: InfoLine | null = null;
    let bestMove: string | null = null;

    return new Promise((resolve, reject) => {
      const off = onLine((line) => {
        if (search !== currentSearch) {
          return;
        }
        const info = parseInfoLine(line);
        if (info !== null) {
          if (info.depth !== null && info.score !== null) {
            latest = info;
          }
          return;
        }
        const move = parseBestMove(line);
        if (move !== null) {
          bestMove = move;
          off();
          signal.removeEventListener('abort', onAbort);
          if (search !== currentSearch) {
            return;
          }
          if (latest !== null && latest.score !== null && bestMove !== null) {
            resolve({
              score: latest.score,
              depth: latest.depth ?? 0,
              pv: latest.pv,
              bestMove,
            });
          } else {
            resolve(null);
          }
        }
      });

      const onAbort = () => {
        off();
        worker.postMessage('stop');
        reject(abortError());
      };
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
  };
}

let shared: ChessEngine | null = null;

export function getSharedEngine(): ChessEngine {
  shared ??= createStockfishEngine();
  return shared;
}
