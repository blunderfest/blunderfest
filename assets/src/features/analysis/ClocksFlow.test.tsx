import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClocksFlow, { thinkTimeLabel } from '@/features/analysis/ClocksFlow';
import type { GameNode, GameTree } from '@/lib/api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function node(partial: Partial<GameNode>): GameNode {
  return {
    id: 0,
    ply: 0,
    san: null,
    from: null,
    to: null,
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    fen: START_FEN,
    children: [],
    ...partial,
  };
}

/** A clocked mainline of e4/e5 alternating, one node per clock value. */
function clockedTree(clocks: (number | null)[]): GameTree {
  const root = node({ id: 0, ply: 0, children: [] });
  let current = root;
  clocks.forEach((clock, i) => {
    const ply = i + 1;
    const next = node({ id: ply, ply, san: 'e4', clock });
    current.children = [next];
    current = next;
  });
  return {
    headers: { TimeControl: '300+3' },
    result: '*',
    setup: null,
    root,
    mainline_ply_count: clocks.length,
    node_count: clocks.length + 1,
  };
}

describe('thinkTimeLabel', () => {
  it('labels seconds under a minute as Ns', () => {
    expect(thinkTimeLabel(4)).toBe('4s');
    expect(thinkTimeLabel(59.4)).toBe('59s');
  });

  it('labels a minute and more as M:SS', () => {
    expect(thinkTimeLabel(60)).toBe('1:00');
    expect(thinkTimeLabel(107)).toBe('1:47');
    expect(thinkTimeLabel(240)).toBe('4:00');
  });
});

describe('ClocksFlow', () => {
  it('renders one bar per clocked move', () => {
    render(<ClocksFlow tree={clockedTree([295, 290, 271])} currentPly={0} onSelectPly={vi.fn()} />);

    const bars = screen.getAllByTestId('clocks-flow-bar');
    expect(bars.map((bar) => bar.getAttribute('data-ply'))).toEqual(['1', '2', '3']);
  });

  it('shows the placeholder for a game without clock data', () => {
    render(<ClocksFlow tree={clockedTree([null, null])} currentPly={0} onSelectPly={vi.fn()} />);

    expect(screen.queryByTestId('clocks-flow-bar')).not.toBeInTheDocument();
    expect(screen.getByText(/No clock data/)).toBeInTheDocument();
  });

  it('jumps to the clicked ply', () => {
    const onSelectPly = vi.fn();
    render(
      <ClocksFlow
        tree={clockedTree([295, 290, 271, 260])}
        currentPly={0}
        onSelectPly={onSelectPly}
      />,
    );
    const chart = screen.getByTestId('clocks-flow');
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 200,
      top: 0,
      height: 64,
      right: 200,
      bottom: 64,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    // 100px of 200px → halfway → ply 2 of 4.
    fireEvent(chart, new MouseEvent('pointerdown', { bubbles: true, clientX: 100 }));
    expect(onSelectPly).toHaveBeenCalledWith(2);
  });

  it('shows the move and its think time while hovering', () => {
    render(<ClocksFlow tree={clockedTree([295, 290, 271])} currentPly={0} onSelectPly={vi.fn()} />);
    const chart = screen.getByTestId('clocks-flow');
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 200,
      top: 0,
      height: 64,
      right: 200,
      bottom: 64,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    // 100px of 200px → ply 2 of 3: 295 − 290 + 3 increment = 8 seconds.
    fireEvent(chart, new MouseEvent('pointermove', { bubbles: true, clientX: 100 }));
    expect(screen.getByTestId('clocks-flow-tooltip')).toHaveTextContent('1… thought 8s');
  });

  it('aligns on the shared span, not the last clocked ply', () => {
    // Clocks end at ply 2 but the game runs to ply 4: the marker for the
    // current ply (2) sits at the halfway line, not at the right edge.
    render(
      <ClocksFlow
        tree={clockedTree([295, 290])}
        currentPly={2}
        spanPly={4}
        onSelectPly={vi.fn()}
      />,
    );

    expect(screen.getByTestId('clocks-flow-marker')).toHaveAttribute('x1', '50');
  });
});
