import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChessEngine, EngineResult } from '@/features/analysis/engine';
import { useEngine } from '@/features/analysis/useEngine';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

function fakeEngine(result: EngineResult | null): ChessEngine & {
  analyze: ReturnType<typeof vi.fn>;
} {
  const analyze = vi.fn((_fen: string, _opts: { movetimeMs: number }, signal: AbortSignal) => {
    return new Promise<EngineResult | null>((resolve, reject) => {
      signal.addEventListener('abort', () =>
        reject(new DOMException('Engine search aborted', 'AbortError')),
      );
      resolve(result);
    });
  });
  return { init: vi.fn(() => Promise.resolve()), analyze, terminate: vi.fn() };
}

const RESULT: EngineResult = {
  score: { type: 'cp', cp: 30 },
  depth: 9,
  pv: ['e2e4'],
  bestMove: 'e2e4',
};

describe('useEngine', () => {
  it('evaluates the position and exposes the white-perspective eval and best move', async () => {
    const engine = fakeEngine(RESULT);
    const { result } = renderHook(() =>
      useEngine(START_FEN, { engine, debounceMs: 0, movetimeMs: 250 }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(engine.analyze).toHaveBeenCalledWith(
      START_FEN,
      { movetimeMs: 250 },
      expect.any(AbortSignal),
    );
    expect(result.current.eval).toEqual({ type: 'cp', cp: 30 });
    expect(result.current.bestMove).toEqual({ from: 'e2', to: 'e4' });
    expect(result.current.depth).toBe(9);
  });

  it('keeps the previous eval and hint visible while the next position is analyzed', async () => {
    const engine = fakeEngine(RESULT);
    const { result, rerender } = renderHook(
      ({ fen }: { fen: string | null }) => useEngine(fen, { engine, debounceMs: 20 }),
      { initialProps: { fen: START_FEN as string | null } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ fen: AFTER_E4_FEN });

    expect(result.current.status).toBe('thinking');
    expect(result.current.eval).toEqual({ type: 'cp', cp: 30 });
    expect(result.current.bestMove).toEqual({ from: 'e2', to: 'e4' });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.eval).toEqual({ type: 'cp', cp: -30 });
  });

  it('flips the eval when black is to move', async () => {
    const engine = fakeEngine(RESULT);
    const { result } = renderHook(() => useEngine(AFTER_E4_FEN, { engine, debounceMs: 0 }));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.eval).toEqual({ type: 'cp', cp: -30 });
  });

  it('only analyzes the latest position when the fen changes quickly', async () => {
    const engine = fakeEngine(RESULT);
    const { result, rerender } = renderHook(
      ({ fen }: { fen: string | null }) => useEngine(fen, { engine, debounceMs: 40 }),
      { initialProps: { fen: START_FEN as string | null } },
    );

    rerender({ fen: AFTER_E4_FEN });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(engine.analyze).toHaveBeenCalledTimes(1);
    expect(engine.analyze).toHaveBeenCalledWith(
      AFTER_E4_FEN,
      expect.anything(),
      expect.any(AbortSignal),
    );
  });

  it('aborts the running search when the position changes', async () => {
    const engine = fakeEngine(RESULT);
    const { result, rerender } = renderHook(
      ({ fen }: { fen: string | null }) => useEngine(fen, { engine, debounceMs: 0 }),
      { initialProps: { fen: START_FEN as string | null } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ fen: AFTER_E4_FEN });

    await waitFor(() => expect(engine.analyze.mock.calls[0][2].aborted).toBe(true));
  });

  it('reports an error when the engine rejects', async () => {
    const engine = fakeEngine(RESULT);
    engine.analyze.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useEngine(START_FEN, { engine, debounceMs: 0 }));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.eval).toBeNull();
  });

  it('stays idle without an engine', async () => {
    const { result } = renderHook(() => useEngine(START_FEN, { engine: null, debounceMs: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current.status).toBe('idle');
    expect(result.current.eval).toBeNull();
  });

  it('stays idle without a fen', async () => {
    const engine = fakeEngine(RESULT);
    const { result } = renderHook(() => useEngine(null, { engine, debounceMs: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current.status).toBe('idle');
    expect(engine.analyze).not.toHaveBeenCalled();
  });
});

describe('terminal positions', () => {
  it('shows the result for a checkmate position without calling the engine', async () => {
    const { result } = renderHook(() =>
      useEngine('R6k/5ppp/8/8/8/8/8/R6K b - - 1 1', {
        engine: null,
        positionStatus: 'checkmate',
        debounceMs: 0,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.eval).toEqual({ type: 'result', result: '1-0' });
    expect(result.current.bestMove).toBeNull();
  });

  it('shows a draw for stalemate', async () => {
    const { result } = renderHook(() =>
      useEngine('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', {
        engine: null,
        positionStatus: 'stalemate',
        debounceMs: 0,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.eval).toEqual({ type: 'result', result: '1/2-1/2' });
  });
});
