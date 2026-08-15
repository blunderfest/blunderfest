import { describe, expect, it } from 'vitest';
import { createStockfishEngine, type WorkerLike } from '@/features/analysis/engine';

class FakeWorker implements WorkerLike {
  messages: string[] = [];
  terminated = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;

  postMessage(message: string) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(line: string) {
    this.onmessage?.({ data: line });
  }

  emitError(message: string) {
    this.onerror?.({ message });
  }
}

/** Let a promise-resolution microtask land between handshake steps. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function bootReady(worker: FakeWorker) {
  const engine = createStockfishEngine(() => worker);
  const init = engine.init();
  worker.emit('uciok');
  await flush();
  worker.emit('readyok');
  await init;
  return engine;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('createStockfishEngine', () => {
  it('runs the uci handshake during init', async () => {
    const worker = new FakeWorker();
    const engine = createStockfishEngine(() => worker);
    const init = engine.init();

    expect(worker.messages).toEqual(['uci']);
    worker.emit('uciok');
    await flush();
    expect(worker.messages).toEqual([
      'uci',
      'setoption name MultiPV value 3',
      'setoption name UCI_ShowWDL value true',
      'isready',
    ]);
    worker.emit('readyok');
    await init;
  });

  it('splits multi-line engine output into lines', async () => {
    const worker = new FakeWorker();
    const engine = await bootReady(worker);

    const promise = engine.analyze(START_FEN, { movetimeMs: 250 }, new AbortController().signal);
    await flush();
    worker.emit('info depth 5 score cp 10 pv e2e4\nbestmove e2e4 ponder e7e5\n');
    expect(await promise).toEqual({
      score: { type: 'cp', cp: 10 },
      depth: 5,
      pv: ['e2e4'],
      bestMove: 'e2e4',
      lines: [{ score: { type: 'cp', cp: 10 }, depth: 5, wdl: null, pv: ['e2e4'] }],
    });
  });

  it('sends the position and go commands, then resolves with the latest scored info and best move', async () => {
    const worker = new FakeWorker();
    const engine = await bootReady(worker);

    const promise = engine.analyze(START_FEN, { movetimeMs: 250 }, new AbortController().signal);
    await flush();

    expect(worker.messages).toEqual([
      'uci',
      'setoption name MultiPV value 3',
      'setoption name UCI_ShowWDL value true',
      'isready',
      `position fen ${START_FEN}`,
      'go movetime 250',
    ]);

    worker.emit('info depth 5 seldepth 8 multipv 1 score cp 10 pv e2e4 e7e5');
    worker.emit('info depth 6 score cp 22 pv e2e4 c7c5');
    worker.emit('bestmove e2e4 ponder c7c5');

    await expect(promise).resolves.toEqual({
      score: { type: 'cp', cp: 22 },
      depth: 6,
      pv: ['e2e4', 'c7c5'],
      bestMove: 'e2e4',
      lines: [{ score: { type: 'cp', cp: 22 }, depth: 6, wdl: null, pv: ['e2e4', 'c7c5'] }],
    });
  });

  it('collects one line per MultiPV rank, best first', async () => {
    const worker = new FakeWorker();
    const engine = await bootReady(worker);

    const promise = engine.analyze(START_FEN, { movetimeMs: 250 }, new AbortController().signal);
    await flush();

    worker.emit('info depth 12 multipv 1 score cp 30 pv e2e4');
    worker.emit('info depth 12 multipv 2 score cp 12 pv d2d4');
    worker.emit('info depth 11 multipv 3 score cp -5 pv c2c4');
    worker.emit('info depth 12 multipv 2 score cp 18 pv g1f3');
    worker.emit('bestmove e2e4');

    await expect(promise).resolves.toMatchObject({
      bestMove: 'e2e4',
      lines: [
        { score: { type: 'cp', cp: 30 }, pv: ['e2e4'] },
        { score: { type: 'cp', cp: 18 }, pv: ['g1f3'] },
        { score: { type: 'cp', cp: -5 }, pv: ['c2c4'] },
      ],
    });
  });

  it('resolves with a mate score', async () => {
    const worker = new FakeWorker();
    const engine = await bootReady(worker);

    const promise = engine.analyze(START_FEN, { movetimeMs: 250 }, new AbortController().signal);
    await flush();
    worker.emit('info depth 12 score mate 4 pv d8h4 g3h4 h7h5 g2g4');
    worker.emit('bestmove d8h4');

    await expect(promise).resolves.toMatchObject({ score: { type: 'mate', mate: 4 } });
  });

  it('aborting rejects with AbortError and sends stop', async () => {
    const worker = new FakeWorker();
    const engine = await bootReady(worker);

    const controller = new AbortController();
    const promise = engine.analyze(START_FEN, { movetimeMs: 250 }, controller.signal);
    await flush();
    worker.emit('info depth 3 score cp 5 pv e2e4');
    controller.abort();

    await expect(promise).rejects.toThrow('Engine search aborted');
    expect(worker.messages).toContain('stop');
  });

  it('ignores a late bestmove from an aborted search', async () => {
    const worker = new FakeWorker();
    const engine = await bootReady(worker);

    const controller = new AbortController();
    const promise = engine.analyze(START_FEN, { movetimeMs: 250 }, controller.signal);
    await flush();
    worker.emit('info depth 3 score cp 5 pv e2e4');
    controller.abort();
    await expect(promise).rejects.toThrow('Engine search aborted');

    worker.emit('bestmove e2e4');
    worker.emit('info depth 9 score cp 99 pv g1f3');
  });

  it('cancels the superseded search when searches overlap', async () => {
    const worker = new FakeWorker();
    const engine = await bootReady(worker);

    const controllerA = new AbortController();
    const first = engine.analyze(START_FEN, { movetimeMs: 250 }, controllerA.signal);
    await flush();
    // Attach the rejection expectation before the second search cancels the
    // first, so the rejection never goes unhandled.
    const firstRejected = expect(first).rejects.toThrow('Engine search aborted');

    const controllerB = new AbortController();
    const second = engine.analyze(START_FEN, { movetimeMs: 250 }, controllerB.signal);
    await flush();

    // The first search is cancelled outright (not left hanging): its
    // listener is dropped and the worker is told to stop.
    await firstRejected;
    expect(worker.messages).toContain('stop');

    worker.emit('info depth 4 score cp 8 pv e2e4');
    worker.emit('bestmove e2e4');

    await expect(second).resolves.toMatchObject({ bestMove: 'e2e4' });
  });

  it('terminates the worker', async () => {
    const worker = new FakeWorker();
    const engine = await bootReady(worker);
    engine.terminate();
    expect(worker.terminated).toBe(true);
  });

  it('rejects immediately when the worker fails to start instead of timing out', async () => {
    const worker = new FakeWorker();
    const engine = createStockfishEngine(() => worker);

    const init = engine.init();
    worker.emitError('Script error.');
    await expect(init).rejects.toThrow('Script error.');

    const later = engine.analyze(START_FEN, { movetimeMs: 250 }, new AbortController().signal);
    await expect(later).rejects.toThrow('Script error.');
  });
});
