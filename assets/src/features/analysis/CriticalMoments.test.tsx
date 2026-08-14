import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CriticalMoments, { criticalMoments } from '@/features/analysis/CriticalMoments';
import type { GameNode, GameTree } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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
    fen: FEN,
    children: [],
    ...partial,
  };
}

// A four-move mainline: 1. e4 e5 2. Nf3 Nc6.
const tree: GameTree = {
  headers: {},
  result: '*',
  setup: null,
  mainline_ply_count: 4,
  node_count: 5,
  root: node({
    id: 0,
    ply: 0,
    san: null,
    children: [
      node({
        id: 1,
        ply: 1,
        san: 'e4',
        children: [
          node({
            id: 2,
            ply: 2,
            san: 'e5',
            children: [
              node({
                id: 3,
                ply: 3,
                san: 'Nf3',
                children: [node({ id: 4, ply: 4, san: 'Nc6' })],
              }),
            ],
          }),
        ],
      }),
    ],
  }),
};

// A blunder on ply 2 (black throws away 3 pawns), an inaccuracy on ply 3.
const evals: AnalysisEval[] = [
  { ply: 0, score: { cp: 20 }, best_move: null },
  { ply: 1, score: { cp: 40 }, best_move: null },
  { ply: 2, score: { cp: 340 }, best_move: null },
  { ply: 3, score: { cp: 160 }, best_move: null },
  { ply: 4, score: { cp: 150 }, best_move: null },
];

describe('criticalMoments', () => {
  it('picks the marked moves in play order', () => {
    const moments = criticalMoments(tree.root, evals);
    expect(moments.map((m) => [m.ply, m.mark])).toEqual([
      [2, '??'],
      [3, '?'],
    ]);
  });

  it('is empty for a clean game', () => {
    const flat: AnalysisEval[] = evals.map((e) => ({ ...e, score: { cp: 20 } }));
    expect(criticalMoments(tree.root, flat)).toEqual([]);
  });
});

describe('CriticalMoments', () => {
  it('renders clickable chips that jump to the position', () => {
    const onSelectPly = vi.fn();
    render(<CriticalMoments tree={tree} evals={evals} onSelectPly={onSelectPly} />);

    const chips = screen.getAllByTestId('critical-moment');
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent('1… e5??');
    expect(chips[0]).toHaveAttribute('title', '+0.4 → +3.4');

    fireEvent.click(chips[0]);
    expect(onSelectPly).toHaveBeenCalledWith(2);
  });

  it('shows a friendly empty state for a clean game', () => {
    const flat: AnalysisEval[] = evals.map((e) => ({ ...e, score: { cp: 20 } }));
    render(<CriticalMoments tree={tree} evals={flat} onSelectPly={vi.fn()} />);

    expect(screen.getByText(/No big swings/)).toBeInTheDocument();
  });
});
