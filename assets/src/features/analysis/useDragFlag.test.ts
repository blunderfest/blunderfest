import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChessEngine } from '@/features/analysis/engine';
import { legalMovesFor } from '@/features/analysis/legalMoves';
import { useDragFlag } from '@/features/analysis/useDragFlag';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * The candidate's post-move eval from the side to move (black after e4):
 * cp 400 = black +4 → -4 for white. Against a +3 baseline: a ?? blunder.
 */
function fakeEngine(cp: number): ChessEngine {
  return {
    init: vi.fn(() => Promise.resolve()),
    analyze: vi.fn(() =>
      Promise.resolve({
        score: { type: 'cp' as const, cp },
        depth: 10,
        pv: ['e2e4'],
        bestMove: 'e2e4',
        lines: [],
      }),
    ),
    terminate: vi.fn(),
    setMultiPV: vi.fn(),
  };
}

function setup({
  cp = 400,
  enabled = true,
  currentEval = { type: 'cp', cp: 300 } as const,
}: {
  cp?: number;
  enabled?: boolean;
  currentEval?: { type: 'cp'; cp: number } | null;
} = {}) {
  const engine = fakeEngine(cp);
  const view = renderHook(() =>
    useDragFlag({
      enabled,
      currentFen: START,
      currentEval,
      legalMoves: legalMovesFor(START),
      engine,
    }),
  );
  return { engine, ...view };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useDragFlag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags a blundering candidate after the debounce', async () => {
    const { result } = setup();

    act(() => {
      result.current.onDragHover('e2', 'e4');
    });
    expect(result.current.flag).toBeNull();

    act(() => {
      vi.advanceTimersByTime(130);
    });
    await settle();

    expect(result.current.flag).toEqual({ square: 'e4', mark: '??' });
  });

  it('shows no flag for a move that holds the eval', async () => {
    // cp -250 (black -2.5 → white +2.5): a 50cp dip, under the ?! floor.
    const { result } = setup({ cp: -250 });

    act(() => {
      result.current.onDragHover('e2', 'e4');
      vi.advanceTimersByTime(130);
    });
    await settle();

    expect(result.current.flag).toBeNull();
  });

  it('clears the flag when the drag leaves the square', async () => {
    const { result } = setup();

    act(() => {
      result.current.onDragHover('e2', 'e4');
      vi.advanceTimersByTime(130);
    });
    await settle();
    expect(result.current.flag).not.toBeNull();

    act(() => {
      result.current.onDragHover('e2', null);
    });

    expect(result.current.flag).toBeNull();
  });

  it('never searches without a baseline eval (engine still thinking)', () => {
    const { result, engine } = setup({ currentEval: null });

    act(() => {
      result.current.onDragHover('e2', 'e4');
      vi.advanceTimersByTime(300);
    });

    expect(engine.analyze).not.toHaveBeenCalled();
    expect(result.current.flag).toBeNull();
  });

  it('does nothing while disabled', () => {
    const { result, engine } = setup({ enabled: false });

    act(() => {
      result.current.onDragHover('e2', 'e4');
      vi.advanceTimersByTime(300);
    });

    expect(engine.analyze).not.toHaveBeenCalled();
    expect(result.current.flag).toBeNull();
  });

  it('searches only the latest hovered square (debounce coalesces the sweep)', async () => {
    const { result, engine } = setup();

    act(() => {
      result.current.onDragHover('e2', 'e3');
      result.current.onDragHover('e2', 'e4');
      vi.advanceTimersByTime(130);
    });
    await settle();

    expect(engine.analyze).toHaveBeenCalledTimes(1);
    expect(vi.mocked(engine.analyze).mock.calls[0][0]).toContain('4P3'); // after e4
  });
});
