import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MaterialFlow, { materialTimeline } from '@/features/analysis/MaterialFlow';
import type { GameNode, GameTree } from '@/lib/api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_D5 = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const AFTER_EXD5 = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';

function node(partial: Partial<GameNode>): GameNode {
  return {
    id: 0,
    ply: 0,
    san: '',
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

// 1. e4 d5 2. exd5 — white wins a pawn on ply 2.
const tree: GameTree = {
  headers: {},
  result: '*',
  setup: null,
  mainline_ply_count: 2,
  node_count: 3,
  root: node({
    id: 0,
    ply: 0,
    san: null,
    children: [
      node({
        id: 1,
        ply: 1,
        san: 'e4',
        from: 'e2',
        to: 'e4',
        fen: AFTER_E4,
        children: [
          node({ id: 2, ply: 2, san: 'd5', from: 'd7', to: 'd5', fen: AFTER_D5, children: [] }),
        ],
      }),
    ],
  }),
};
tree.root.children[0].children[0].children.push(
  node({ id: 3, ply: 3, san: 'exd5', from: 'e4', to: 'd5', fen: AFTER_EXD5 }),
);

function mockChartRect(svg: HTMLElement, width = 200) {
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    width,
    top: 0,
    height: 80,
    right: width,
    bottom: 80,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('materialTimeline', () => {
  it('tracks the balance per ply', () => {
    expect(materialTimeline(tree.root).map((p) => [p.ply, p.balance])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 1],
    ]);
  });

  it('reports the capture with victim and capturer', () => {
    const capture = materialTimeline(tree.root)[3].capture;
    expect(capture).toEqual({
      by: { color: 'w', kind: 'p' },
      victim: { color: 'b', kind: 'p' },
    });
  });

  it('detects no capture on quiet moves', () => {
    expect(materialTimeline(tree.root)[2].capture).toBeNull();
  });
});

describe('MaterialFlow', () => {
  it('renders the balance area with fallen pieces on the capture track', () => {
    render(<MaterialFlow tree={tree} currentPly={3} onSelectPly={vi.fn()} />);

    expect(screen.getByTestId('material-flow-area')).toBeInTheDocument();
    expect(screen.getByTestId('material-flow-marker')).toHaveAttribute('x1', '100');
    expect(screen.getAllByTestId('material-flow-capture')).toHaveLength(1);
  });

  it('shows the balance and the capture while hovering', () => {
    render(<MaterialFlow tree={tree} currentPly={0} onSelectPly={vi.fn()} />);
    const chart = screen.getByTestId('material-flow');
    mockChartRect(chart);

    // 200px of 200px → ply 3: white up a pawn.
    fireEvent(chart, new MouseEvent('pointermove', { bubbles: true, clientX: 200 }));
    const tooltip = screen.getByTestId('material-flow-tooltip');
    expect(tooltip).toHaveTextContent('2.');
    expect(tooltip).toHaveTextContent('+1');
    // The capture pair renders as two piece images.
    expect(tooltip.querySelectorAll('img')).toHaveLength(2);
  });

  it('mirrors the territory when the board is flipped', () => {
    const { rerender } = render(<MaterialFlow tree={tree} currentPly={0} onSelectPly={vi.fn()} />);
    expect(screen.getByTestId('material-flow-area').getAttribute('d')).toMatch(/^M0\.00 40 /);
    rerender(<MaterialFlow tree={tree} currentPly={0} flipped onSelectPly={vi.fn()} />);
    expect(screen.getByTestId('material-flow-area').getAttribute('d')).toMatch(/^M0\.00 0 /);
  });
});
