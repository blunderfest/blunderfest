import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Analysis from '@/features/analysis/Analysis';
import type { GameNode, GameTree } from '@/lib/api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function node(partial: Partial<GameNode>): GameNode {
  return {
    id: 0,
    ply: 1,
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

const tree: GameTree = {
  headers: { White: 'Alice', Black: 'Bob', Event: 'Test Game' },
  result: '*',
  setup: null,
  mainline_ply_count: 4,
  node_count: 6,
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
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        children: [
          node({
            id: 2,
            ply: 2,
            san: 'e5',
            from: 'e7',
            to: 'e5',
            fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
            children: [
              node({
                id: 4,
                ply: 3,
                san: 'Nf3',
                from: 'g1',
                to: 'f3',
                fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
              }),
            ],
          }),
          node({
            id: 3,
            ply: 2,
            san: 'c5',
            from: 'c7',
            to: 'c5',
            fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2',
            comment: 'Sicilian',
          }),
        ],
      }),
    ],
  }),
};

function renderAnalysis() {
  return render(<Analysis tree={tree} />);
}

describe('Analysis', () => {
  it('renders the start position on the board', () => {
    renderAnalysis();

    expect(screen.getByTestId('square-e1')).toHaveTextContent('♔');
    expect(screen.getByTestId('square-e8')).toHaveTextContent('♚');
    expect(screen.getByTestId('square-d2')).toHaveTextContent('♙');
    expect(screen.getByTestId('square-e4')).not.toHaveTextContent('♙');
  });

  it('navigates forward and backward with the buttons', () => {
    renderAnalysis();

    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }));
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♙');
    expect(screen.getByTestId('square-e2')).not.toHaveTextContent('♙');

    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }));
    expect(screen.getByTestId('square-e5')).toHaveTextContent('♟');

    fireEvent.click(screen.getByRole('button', { name: '◀ Previous' }));
    expect(screen.getByTestId('square-e5')).not.toHaveTextContent('♟');
  });

  it('jumps to first and last moves', () => {
    renderAnalysis();

    fireEvent.click(screen.getByRole('button', { name: 'Last ⏭' }));
    expect(screen.getByTestId('square-f3')).toHaveTextContent('♘');
    expect(screen.getByTestId('analysis-move-4')).toHaveClass('bg-ink/20');

    fireEvent.click(screen.getByRole('button', { name: '⏮ First' }));
    expect(screen.getByTestId('square-g1')).toHaveTextContent('♘');
  });

  it('clicks a variation in the move list', () => {
    renderAnalysis();

    fireEvent.click(screen.getByTestId('analysis-move-3'));
    expect(screen.getByTestId('square-c5')).toHaveTextContent('♟');
    expect(screen.getByText('Sicilian')).toBeInTheDocument();
  });

  it('shows the checkmate status badge', () => {
    const mateTree: GameTree = {
      ...tree,
      root: node({
        id: 0,
        ply: 0,
        san: null,
        children: [
          node({
            id: 1,
            ply: 1,
            san: 'Ra8#',
            from: 'a1',
            to: 'a8',
            status: 'checkmate',
            fen: 'R6k/5ppp/8/8/8/8/8/R6K b - - 1 1',
          }),
        ],
      }),
    };
    render(<Analysis tree={mateTree} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }));
    expect(screen.getByText('Checkmate')).toBeInTheDocument();
  });

  it('navigates with the arrow keys', () => {
    renderAnalysis();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♙');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('square-e4')).not.toHaveTextContent('♙');
  });

  it('shows the fallback screen when no game is loaded', () => {
    render(<Analysis tree={null} />);

    expect(screen.getByText('Import a game to start analyzing.')).toBeInTheDocument();
  });

  it('jumps with Home and End keys', () => {
    renderAnalysis();

    fireEvent.keyDown(window, { key: 'End' });
    expect(screen.getByTestId('square-f3')).toHaveTextContent('♘');

    fireEvent.keyDown(window, { key: 'Home' });
    expect(screen.getByTestId('square-g1')).toHaveTextContent('♘');
  });

  it('flips the board with the f key', () => {
    renderAnalysis();

    const board = () => screen.getByRole('img', { name: 'Chess board after start position' });
    const squares = () =>
      Array.from(board().querySelectorAll('[data-testid^="square-"]')).map((el) =>
        el.getAttribute('data-testid'),
      );

    expect(squares()[0]).toBe('square-a8');

    fireEvent.keyDown(window, { key: 'f' });

    expect(squares()[0]).toBe('square-h1');
    expect(screen.getByRole('button', { name: 'Flip board' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('follows the presenter cursor', () => {
    render(<Analysis tree={tree} presenterId="p1" selfId="me" presenterCursorId={2} />);

    expect(screen.getByTestId('square-e5')).toHaveTextContent('♟');
    expect(screen.getByRole('button', { name: 'Following presenter' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('breaks away from the presenter on local navigation', () => {
    const { rerender } = render(
      <Analysis tree={tree} presenterId="p1" selfId="me" presenterCursorId={2} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }));

    expect(screen.getByTestId('square-e4')).toHaveTextContent('♙');
    rerender(<Analysis tree={tree} presenterId="p1" selfId="me" presenterCursorId={4} />);
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♙');
    expect(screen.getByRole('button', { name: 'Follow presenter' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('re-follows the presenter after breaking away', () => {
    const { rerender } = render(
      <Analysis tree={tree} presenterId="p1" selfId="me" presenterCursorId={2} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }));

    rerender(<Analysis tree={tree} presenterId="p1" selfId="me" presenterCursorId={4} />);
    fireEvent.click(screen.getByRole('button', { name: 'Follow presenter' }));

    expect(screen.getByTestId('square-f3')).toHaveTextContent('♘');
    expect(screen.getByRole('button', { name: 'Following presenter' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('broadcasts navigation while presenting', () => {
    const onCursorChange = vi.fn();
    render(<Analysis tree={tree} presenterId="p1" selfId="p1" onCursorChange={onCursorChange} />);

    expect(onCursorChange).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }));
    expect(onCursorChange).toHaveBeenCalledWith(1);
    expect(screen.getByText('You are presenting')).toBeInTheDocument();
  });

  it('shows no follow button without a presenter', () => {
    renderAnalysis();

    expect(screen.queryByRole('button', { name: 'Follow presenter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Following presenter' })).not.toBeInTheDocument();
  });
});
