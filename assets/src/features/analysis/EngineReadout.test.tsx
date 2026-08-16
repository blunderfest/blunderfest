import { fireEvent, render, screen } from '@testing-library/react';
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
            { eval: { type: 'cp', cp: 30 }, depth: 12, wdl: null, pv: ['e2e4'] },
            { eval: { type: 'cp', cp: 12 }, depth: 11, wdl: null, pv: ['d2d4'] },
          ],
        })}
      />,
    );

    const lines = screen.getAllByTestId('engine-line');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent('+0.30');
    expect(lines[1]).toHaveTextContent('+0.12');
  });

  it('shows the win/draw/loss bar for the best line', () => {
    render(
      <EngineReadout
        fen={START_FEN}
        state={state({
          eval: { type: 'cp', cp: 30 },
          lines: [
            {
              eval: { type: 'cp', cp: 30 },
              depth: 12,
              wdl: { win: 523, draw: 428, loss: 49 },
              pv: ['e2e4'],
            },
          ],
        })}
      />,
    );

    const bar = screen.getByTestId('engine-wdl');
    expect(bar).toHaveAttribute('title', 'White win · draw · black win: 52% · 43% · 5%');
  });

  it('offers line insertion to editors and reports the UCI pv', () => {
    const onInsertLine = vi.fn();
    render(
      <EngineReadout
        fen={START_FEN}
        onInsertLine={onInsertLine}
        state={state({
          eval: { type: 'cp', cp: 30 },
          lines: [
            { eval: { type: 'cp', cp: 30 }, depth: 12, wdl: null, pv: ['e2e4', 'e7e5'] },
            { eval: { type: 'cp', cp: 12 }, depth: 11, wdl: null, pv: ['d2d4'] },
          ],
        })}
      />,
    );

    const buttons = screen.getAllByTestId('engine-pv-insert');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(onInsertLine).toHaveBeenCalledWith(['d2d4']);
  });

  it('keeps lines read-only without an insert handler', () => {
    render(
      <EngineReadout
        fen={START_FEN}
        state={state({
          eval: { type: 'cp', cp: 30 },
          lines: [{ eval: { type: 'cp', cp: 30 }, depth: 12, wdl: null, pv: ['e2e4'] }],
        })}
      />,
    );

    expect(screen.queryByTestId('engine-pv-insert')).toBeNull();
    expect(screen.getByTestId('engine-pv')).toBeInTheDocument();
  });
});
