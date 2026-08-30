import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RemainingClocksFlow from '@/features/analysis/RemainingClocksFlow';
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

/** A clocked mainline, one node per clock value. */
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

describe('RemainingClocksFlow', () => {
  it('renders two draining lines, one per side', () => {
    render(
      <RemainingClocksFlow
        tree={clockedTree([295, 290, 271, 260])}
        currentPly={0}
        onSelectPly={vi.fn()}
      />,
    );

    const white = screen.getByTestId('remaining-clocks-white');
    const black = screen.getByTestId('remaining-clocks-black');
    // White plays odd plies (1, 3) → two points; black even (2, 4) → two.
    expect(white.getAttribute('points')?.trim().split(' ')).toHaveLength(2);
    expect(black.getAttribute('points')?.trim().split(' ')).toHaveLength(2);
    // Black's line is dashed, white's solid.
    expect(black.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(white.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('shows the placeholder for a game without clock data', () => {
    render(
      <RemainingClocksFlow tree={clockedTree([null, null])} currentPly={0} onSelectPly={vi.fn()} />,
    );

    expect(screen.queryByTestId('remaining-clocks-white')).not.toBeInTheDocument();
    expect(screen.getByText(/No clock data/)).toBeInTheDocument();
  });

  it('shows both sides’ remaining clocks while hovering', () => {
    render(
      <RemainingClocksFlow
        tree={clockedTree([295, 290, 271])}
        currentPly={0}
        onSelectPly={vi.fn()}
      />,
    );
    const chart = screen.getByTestId('remaining-clocks-flow');
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

    // 100px of 200px → ply 2 of 3: white's last clock is 295 (ply 1),
    // black's is 290 (ply 2).
    fireEvent(chart, new MouseEvent('pointermove', { bubbles: true, clientX: 100 }));
    const tooltip = screen.getByTestId('remaining-clocks-tooltip');
    expect(tooltip).toHaveTextContent('White 4:55');
    expect(tooltip).toHaveTextContent('Black 4:50');
  });

  it('aligns on the shared span, not the last clocked ply', () => {
    render(
      <RemainingClocksFlow
        tree={clockedTree([295, 290])}
        currentPly={2}
        spanPly={4}
        onSelectPly={vi.fn()}
      />,
    );

    expect(screen.getByTestId('remaining-clocks-marker')).toHaveAttribute('x1', '50');
  });
});
