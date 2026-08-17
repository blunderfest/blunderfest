import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GameReport from '@/features/analysis/GameReport';
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
  headers: { White: 'Alice', Black: 'Bob' },
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

// A blunder on ply 2 (black throws away 3 pawns), a mistake on ply 3.
const evals: AnalysisEval[] = [
  { ply: 0, score: { cp: 20 }, best_move: null },
  { ply: 1, score: { cp: 40 }, best_move: null },
  { ply: 2, score: { cp: 340 }, best_move: null },
  { ply: 3, score: { cp: 160 }, best_move: null },
  { ply: 4, score: { cp: 150 }, best_move: null },
];

describe('GameReport', () => {
  it('renders an accuracy card per side with mark counts', () => {
    render(<GameReport tree={tree} evals={evals} onSelectPly={vi.fn()} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // White played the mistake, black the blunder.
    expect(screen.getByText('?? 0 · ? 1 · ?! 0')).toBeInTheDocument();
    expect(screen.getByText('?? 1 · ? 0 · ?! 0')).toBeInTheDocument();
    // Both cards show a percentage.
    expect(screen.getAllByText(/%$/)).toHaveLength(2);
    // The blunder drags Bob's accuracy well below Alice's.
    const [alice, bob] = screen
      .getAllByText(/%$/)
      .map((el) => Number.parseFloat(el.textContent ?? '0'));
    expect(alice).toBeGreaterThan(bob);
  });

  it('lists every marked move with the swing and jumps on click', () => {
    const onSelectPly = vi.fn();
    render(<GameReport tree={tree} evals={evals} onSelectPly={onSelectPly} />);

    const first = screen.getByTestId('game-report-move-2');
    expect(first).toHaveTextContent('1… e5??');
    expect(first).toHaveTextContent('+0.4 → +3.4');
    expect(screen.getByTestId('game-report-move-3')).toHaveTextContent('2. Nf3?');

    fireEvent.click(first);
    expect(onSelectPly).toHaveBeenCalledWith(2);
  });

  it('shows the clean-game note when nothing is marked', () => {
    const flat: AnalysisEval[] = evals.map((e) => ({ ...e, score: { cp: 20 } }));
    render(<GameReport tree={tree} evals={flat} onSelectPly={vi.fn()} />);

    expect(screen.getByText(/No big swings/)).toBeInTheDocument();
    expect(screen.queryByTestId('game-report-moves')).not.toBeInTheDocument();
  });

  it('shows the result and opening in a header line', () => {
    const won: GameTree = { ...tree, result: '1-0' };
    render(
      <GameReport
        tree={won}
        evals={evals}
        opening={{ eco: 'C57', name: 'Two Knights Defense' }}
        onSelectPly={vi.fn()}
      />,
    );

    expect(screen.getByTestId('game-report-header')).toHaveTextContent(
      '1-0 · C57 · Two Knights Defense',
    );
  });

  it('omits the header for an unfinished game outside the book', () => {
    render(<GameReport tree={tree} evals={evals} onSelectPly={vi.fn()} />);

    expect(screen.queryByTestId('game-report-header')).not.toBeInTheDocument();
  });

  it('falls back to a dash when a side has no evaluable moves', () => {
    const empty: GameTree = {
      ...tree,
      mainline_ply_count: 0,
      node_count: 1,
      root: node({ id: 0, ply: 0, san: null }),
    };
    render(<GameReport tree={empty} evals={[]} onSelectPly={vi.fn()} />);

    expect(screen.getAllByText('–')).toHaveLength(2);
  });
});
