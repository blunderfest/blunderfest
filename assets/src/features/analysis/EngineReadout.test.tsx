import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EngineReadout from '@/features/analysis/EngineReadout';
import type { EngineState } from '@/features/analysis/useEngine';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function state(overrides: Partial<EngineState>): EngineState {
  return {
    status: 'ready',
    eval: null,
    bestMove: null,
    depth: null,
    pv: [],
    lines: [],
    retry: vi.fn(),
    ...overrides,
  };
}

describe('EngineReadout', () => {
  it('shows the result badge for a terminal position (no engine lines)', () => {
    render(
      <EngineReadout fen={START_FEN} state={state({ eval: { type: 'result', result: '1-0' } })} />,
    );

    expect(screen.getByTestId('engine-eval-badge')).toHaveTextContent('1-0');
  });

  it('shows every MultiPV line, best first', () => {
    render(
      <EngineReadout
        fen={START_FEN}
        state={state({
          eval: { type: 'cp', cp: 30 },
          depth: 12,
          pv: ['e2e4'],
          lines: [
            { eval: { type: 'cp', cp: 30 }, depth: 12, pv: ['e2e4'] },
            { eval: { type: 'cp', cp: 12 }, depth: 11, pv: ['d2d4'] },
          ],
        })}
      />,
    );

    const lines = screen.getAllByTestId('engine-line');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent('+0.30');
    expect(lines[1]).toHaveTextContent('+0.12');
  });
});
