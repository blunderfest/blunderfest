import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GameFlow from '@/features/analysis/GameFlow';
import type { AnalysisEval } from '@/protocol/ops';

const evals: AnalysisEval[] = [
  { ply: 0, score: { cp: 20 }, best_move: null },
  { ply: 1, score: { cp: 40 }, best_move: null },
  { ply: 2, score: { cp: -150 }, best_move: null },
  { ply: 3, score: { cp: -300 }, best_move: null },
  { ply: 4, score: { cp: 0 }, best_move: null },
];

/** jsdom gives SVGs a zero rect — fake a 200px-wide chart at the origin. */
function mockChartRect(svg: HTMLElement, width = 200) {
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    width,
    top: 0,
    height: 64,
    right: width,
    bottom: 64,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('GameFlow', () => {
  it('draws one continuous area when every ply has an eval', () => {
    render(<GameFlow evals={evals} currentPly={0} onSelectPly={vi.fn()} />);

    expect(screen.getAllByTestId('game-flow-area')).toHaveLength(1);
    expect(screen.getByRole('img', { name: /Game flow chart/ })).toBeInTheDocument();
  });

  it('places the marker at the current ply', () => {
    render(<GameFlow evals={evals} currentPly={2} onSelectPly={vi.fn()} />);

    // Ply 2 of 4 → halfway across the 100-wide viewBox.
    expect(screen.getByTestId('game-flow-marker')).toHaveAttribute('x1', '50');
  });

  it('breaks the area around a failed (null) eval', () => {
    const withGap: AnalysisEval[] = [
      evals[0],
      evals[1],
      { ply: 2, score: null, best_move: null },
      evals[3],
      evals[4],
    ];
    render(<GameFlow evals={withGap} currentPly={0} onSelectPly={vi.fn()} />);

    expect(screen.getAllByTestId('game-flow-area')).toHaveLength(2);
  });

  it('jumps to the clicked ply', () => {
    const onSelectPly = vi.fn();
    render(<GameFlow evals={evals} currentPly={0} onSelectPly={onSelectPly} />);
    const chart = screen.getByTestId('game-flow');
    mockChartRect(chart);

    // jsdom's PointerEvent drops coordinates; a typed MouseEvent carries them.
    fireEvent(chart, new MouseEvent('pointerdown', { bubbles: true, clientX: 100 }));

    // 100px of 200px → halfway → ply 2 of 4.
    expect(onSelectPly).toHaveBeenCalledWith(2);
  });

  it('scrubs while dragging and clamps to the last ply', () => {
    const onSelectPly = vi.fn();
    render(<GameFlow evals={evals} currentPly={0} onSelectPly={onSelectPly} />);
    const chart = screen.getByTestId('game-flow');
    mockChartRect(chart);

    fireEvent(chart, new MouseEvent('pointerdown', { bubbles: true, clientX: 50 }));
    fireEvent(chart, new MouseEvent('pointermove', { bubbles: true, clientX: 250, buttons: 1 }));

    expect(onSelectPly).toHaveBeenNthCalledWith(1, 1);
    expect(onSelectPly).toHaveBeenNthCalledWith(2, 4);
  });

  it('renders nothing for a position-only analysis', () => {
    const { container } = render(
      <GameFlow
        evals={[{ ply: 0, score: { cp: 20 }, best_move: null }]}
        currentPly={0}
        onSelectPly={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('mirrors the territory when the board is flipped', () => {
    const { rerender } = render(<GameFlow evals={evals} currentPly={0} onSelectPly={vi.fn()} />);

    // Default: white's area fills from the bottom edge (y = 40)…
    expect(screen.getByTestId('game-flow-area').getAttribute('d')).toMatch(/^M0\.00 40 /);
    // …flipped: from the top edge (y = 0).
    rerender(<GameFlow evals={evals} currentPly={0} flipped onSelectPly={vi.fn()} />);
    expect(screen.getByTestId('game-flow-area').getAttribute('d')).toMatch(/^M0\.00 0 /);
  });

  it('shows the ply and its eval while hovering', () => {
    render(<GameFlow evals={evals} currentPly={0} onSelectPly={vi.fn()} />);
    const chart = screen.getByTestId('game-flow');
    mockChartRect(chart);

    expect(screen.queryByTestId('game-flow-tooltip')).not.toBeInTheDocument();
    // 100px of 200px → ply 2 of 4 (cp −150 → -1.5).
    fireEvent(chart, new MouseEvent('pointermove', { bubbles: true, clientX: 100 }));
    expect(screen.getByTestId('game-flow-tooltip')).toHaveTextContent('1… -1.5');
    expect(screen.getByTestId('game-flow-hover')).toHaveAttribute('x1', '50');

    // React synthesizes pointerleave from the native pointerout event.
    fireEvent(chart, new MouseEvent('pointerout', { bubbles: true }));
    expect(screen.queryByTestId('game-flow-tooltip')).not.toBeInTheDocument();
  });

  it('dots the curve with move-quality marks', () => {
    // ?! at ply 1 (white loses 80), ? at ply 2 (black loses 240), ?? at ply 3 (white loses 310).
    const swingy: AnalysisEval[] = [
      { ply: 0, score: { cp: 0 }, best_move: null },
      { ply: 1, score: { cp: -80 }, best_move: null },
      { ply: 2, score: { cp: 160 }, best_move: null },
      { ply: 3, score: { cp: -150 }, best_move: null },
    ];
    render(<GameFlow evals={swingy} currentPly={0} onSelectPly={vi.fn()} />);

    const marks = screen.getAllByTestId('game-flow-mark');
    expect(marks.map((m) => m.getAttribute('data-mark'))).toEqual(['?!', '?', '??']);
  });

  it('shows a quality cell per move, colored by severity', () => {
    // ?! at ply 1 (white loses 80), ? at ply 2 (black loses 240), ?? at ply 3 (white loses 310).
    const swingy: AnalysisEval[] = [
      { ply: 0, score: { cp: 0 }, best_move: null },
      { ply: 1, score: { cp: -80 }, best_move: null },
      { ply: 2, score: { cp: 160 }, best_move: null },
      { ply: 3, score: { cp: -150 }, best_move: null },
    ];
    render(<GameFlow evals={swingy} currentPly={2} onSelectPly={vi.fn()} />);

    const cells = screen.getAllByTestId('game-flow-quality-cell');
    expect(cells.map((c) => c.getAttribute('data-mark'))).toEqual(['?!', '?', '??']);
    // The current ply's cell wears the gold ring.
    expect(cells[1].className).toContain('ring-gold');
    expect(cells[0].className).not.toContain('ring-gold');
  });

  it('leaves neutral cells subtle when nothing went wrong', () => {
    const flat: AnalysisEval[] = [
      { ply: 0, score: { cp: 20 }, best_move: null },
      { ply: 1, score: { cp: 25 }, best_move: null },
      { ply: 2, score: { cp: 20 }, best_move: null },
    ];
    render(<GameFlow evals={flat} currentPly={0} onSelectPly={vi.fn()} />);

    const cells = screen.getAllByTestId('game-flow-quality-cell');
    expect(cells).toHaveLength(2);
    expect(cells.map((c) => c.getAttribute('data-mark'))).toEqual(['', '']);
  });

  it('marks the opening-book exit and mentions it in the hover readout', () => {
    render(<GameFlow evals={evals} currentPly={0} openingExitPly={2} onSelectPly={vi.fn()} />);
    const chart = screen.getByTestId('game-flow');
    mockChartRect(chart);

    expect(screen.getByTestId('game-flow-book-exit')).toBeInTheDocument();
    fireEvent(chart, new MouseEvent('pointermove', { bubbles: true, clientX: 100 }));
    expect(screen.getByTestId('game-flow-tooltip')).toHaveTextContent('1… -1.5 leaves the book');
  });
});
