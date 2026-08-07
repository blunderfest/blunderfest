import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Analysis from '@/features/analysis/Analysis';
import type { GameNode, GameTree, LegalMove } from '@/lib/api';

const { fetchLegalMovesMock } = vi.hoisted(() => ({ fetchLegalMovesMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchLegalMoves: fetchLegalMovesMock };
});

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

const startMoves: LegalMove[] = [
  {
    from: 'e2',
    to: 'e4',
    promotion: null,
    san: 'e4',
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    status: 'active',
  },
  {
    from: 'e2',
    to: 'e3',
    promotion: null,
    san: 'e3',
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    status: 'active',
  },
  {
    from: 'g1',
    to: 'f3',
    promotion: null,
    san: 'Nf3',
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 1',
    status: 'active',
  },
];

describe('Analysis', () => {
  beforeEach(() => {
    fetchLegalMovesMock.mockReset();
    fetchLegalMovesMock.mockResolvedValue({ moves: [] });
  });
  it('opens on the latest mainline position (so a refresh restores the game state)', () => {
    renderAnalysis();

    expect(screen.getByTestId('square-f3')).toHaveTextContent('♞');
    expect(screen.getByTestId('square-g1')).not.toHaveTextContent('♞');
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♟');
  });

  it('navigates forward and backward with the buttons', () => {
    renderAnalysis();

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♟');
    expect(screen.getByTestId('square-e2')).not.toHaveTextContent('♟');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('square-e5')).toHaveTextContent('♟');

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByTestId('square-e5')).not.toHaveTextContent('♟');
  });

  it('jumps to first and last moves', () => {
    renderAnalysis();

    fireEvent.click(screen.getByRole('button', { name: 'Last' }));
    expect(screen.getByTestId('square-f3')).toHaveTextContent('♞');
    expect(screen.getByTestId('analysis-move-4')).toHaveAttribute('aria-current', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    expect(screen.getByTestId('square-g1')).toHaveTextContent('♞');
  });

  it('clicks a variation in the move list', () => {
    renderAnalysis();

    fireEvent.click(screen.getByTestId('analysis-move-3'));
    expect(screen.getByTestId('square-c5')).toHaveTextContent('♟');
    expect(screen.getByTestId('comment-bubble')).toHaveTextContent('Sicilian');
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

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Checkmate')).toBeInTheDocument();
  });

  it('navigates with the arrow keys', () => {
    renderAnalysis();
    const root = () => screen.getByTestId('analysis-root');

    fireEvent.keyDown(root(), { key: 'Home' });
    fireEvent.keyDown(root(), { key: 'ArrowRight' });
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♟');

    fireEvent.keyDown(root(), { key: 'ArrowLeft' });
    expect(screen.getByTestId('square-e4')).not.toHaveTextContent('♟');
  });

  it('navigates with the arrow keys even when focus is outside the analysis region', () => {
    renderAnalysis();

    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♟');
  });

  it('navigates the game when arrows are pressed on a square focused by mouse', () => {
    render(<Analysis tree={tree} canEdit onPlayMove={vi.fn()} />);

    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.keyDown(screen.getByTestId('square-e2'), { key: 'ArrowRight' });
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♟');
  });

  it('ignores the navigation keys while typing in the comment editor', () => {
    render(<Analysis tree={tree} canEdit onComment={vi.fn()} />);

    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.keyDown(document.body, { key: 'c' });
    fireEvent.keyDown(screen.getByTestId('comment-editor'), { key: 'ArrowRight' });
    expect(screen.getByTestId('square-e4')).not.toHaveTextContent('♟');
  });

  it('ignores the navigation keys when a modifier is held', () => {
    renderAnalysis();

    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight', ctrlKey: true });
    expect(screen.getByTestId('square-e4')).not.toHaveTextContent('♟');
  });

  it('shows the fallback screen when no game is loaded', () => {
    render(<Analysis tree={null} />);

    expect(screen.getByText('Import a game to start analyzing.')).toBeInTheDocument();
  });

  it('jumps with Home and End keys', () => {
    renderAnalysis();
    const root = () => screen.getByTestId('analysis-root');

    fireEvent.keyDown(root(), { key: 'End' });
    expect(screen.getByTestId('square-f3')).toHaveTextContent('♞');

    fireEvent.keyDown(root(), { key: 'Home' });
    expect(screen.getByTestId('square-g1')).toHaveTextContent('♞');
  });

  it('flips the board with the f key', () => {
    renderAnalysis();

    fireEvent.keyDown(document.body, { key: 'Home' });
    const board = () => screen.getByRole('img', { name: 'Chess board after start position' });
    const squares = () =>
      Array.from(board().querySelectorAll('[data-testid^="square-"]')).map((el) =>
        el.getAttribute('data-testid'),
      );

    expect(squares()[0]).toBe('square-a8');

    fireEvent.keyDown(screen.getByTestId('analysis-root'), { key: 'f' });

    expect(squares()[0]).toBe('square-h1');
    expect(screen.getByRole('button', { name: 'Flip board' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('follows the presenter cursor', () => {
    render(<Analysis tree={tree} presenterId="p1" selfId="me" presenterCursorId={2} following />);

    expect(screen.getByTestId('square-e5')).toHaveTextContent('♟');
    expect(screen.getByRole('button', { name: 'Following presenter' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('breaks away from the presenter on local navigation', () => {
    const onFollowChange = vi.fn();
    const { rerender } = render(
      <Analysis
        tree={tree}
        presenterId="p1"
        selfId="me"
        presenterCursorId={2}
        following
        onFollowChange={onFollowChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // The navigation asks the parent to stop following; until the parent
    // confirms (rerender with `following={false}`), the presenter cursor
    // still drives the board.
    expect(onFollowChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('square-e5')).toHaveTextContent('♟');
    rerender(
      <Analysis
        tree={tree}
        presenterId="p1"
        selfId="me"
        presenterCursorId={4}
        following={false}
        onFollowChange={onFollowChange}
      />,
    );
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♟');
    expect(screen.getByRole('button', { name: 'Follow presenter' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('re-follows the presenter after breaking away', () => {
    const onFollowChange = vi.fn();
    const { rerender } = render(
      <Analysis
        tree={tree}
        presenterId="p1"
        selfId="me"
        presenterCursorId={2}
        following={false}
        onFollowChange={onFollowChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Follow presenter' }));

    expect(onFollowChange).toHaveBeenCalledWith(true);
    rerender(
      <Analysis
        tree={tree}
        presenterId="p1"
        selfId="me"
        presenterCursorId={4}
        following
        onFollowChange={onFollowChange}
      />,
    );
    expect(screen.getByTestId('square-f3')).toHaveTextContent('♞');
    expect(screen.getByRole('button', { name: 'Following presenter' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('broadcasts navigation while presenting', () => {
    const onCursorChange = vi.fn();
    render(<Analysis tree={tree} presenterId="p1" selfId="p1" onCursorChange={onCursorChange} />);

    expect(onCursorChange).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onCursorChange).toHaveBeenCalledWith(2);
    expect(screen.getByText(/You are presenting/)).toBeInTheDocument();
  });

  it('shows no follow button without a presenter', () => {
    renderAnalysis();

    expect(screen.queryByRole('button', { name: 'Follow presenter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Following presenter' })).not.toBeInTheDocument();
  });

  it('lets an editor play a move from the board', async () => {
    fetchLegalMovesMock.mockResolvedValue({ moves: startMoves });
    const onPlayMove = vi.fn();
    render(<Analysis tree={tree} presenterId="p1" selfId="p1" canEdit onPlayMove={onPlayMove} />);

    await waitFor(() => expect(fetchLegalMovesMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    await waitFor(() => expect(fetchLegalMovesMock).toHaveBeenCalledTimes(2));
    await act(async () => {});
    fireEvent.click(screen.getByTestId('square-e2'));

    await waitFor(() => expect(screen.getByTestId('selected-e2')).toBeInTheDocument());
    expect(screen.getByTestId('target-e4')).toBeInTheDocument();
    expect(screen.getByTestId('target-e3')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('square-e4'));

    await waitFor(() => expect(onPlayMove).toHaveBeenCalledTimes(1));
    expect(onPlayMove).toHaveBeenCalledWith({
      ply: 1,
      san: 'e4',
      from: 'e2',
      to: 'e4',
      promotion: null,
      fen: startMoves[0].fen,
      status: 'active',
      parent_id: tree.root.id,
    });
  });

  it('does not let viewers play moves', () => {
    const onPlayMove = vi.fn();
    render(<Analysis tree={tree} presenterId="p1" selfId="me" onPlayMove={onPlayMove} />);

    fireEvent.click(screen.getByTestId('square-e2'));
    fireEvent.click(screen.getByTestId('square-e4'));

    expect(onPlayMove).not.toHaveBeenCalled();
    expect(fetchLegalMovesMock).not.toHaveBeenCalled();
  });

  it('lets a collaborator play moves without presenting or broadcasting the cursor', async () => {
    fetchLegalMovesMock.mockResolvedValue({ moves: startMoves });
    const onCursorChange = vi.fn();
    const onPlayMove = vi.fn();
    render(
      <Analysis
        tree={tree}
        presenterId="p1"
        selfId="me"
        canEdit
        onCursorChange={onCursorChange}
        onPlayMove={onPlayMove}
      />,
    );

    await waitFor(() => expect(fetchLegalMovesMock).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('square-e2'));
    await waitFor(() => expect(screen.getByTestId('target-e4')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('square-e4'));

    await waitFor(() => expect(onPlayMove).toHaveBeenCalledTimes(1));
    expect(onCursorChange).not.toHaveBeenCalled();
    expect(screen.queryByText('You are presenting')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow presenter' })).toBeInTheDocument();
  });

  it('stays on a played move before and after the echo applies it', async () => {
    fetchLegalMovesMock.mockResolvedValue({ moves: startMoves });
    const onCursorChange = vi.fn();
    const onPlayMove = vi.fn();
    const { rerender } = render(
      <Analysis
        tree={tree}
        presenterId="p1"
        selfId="p1"
        canEdit
        onCursorChange={onCursorChange}
        onPlayMove={onPlayMove}
      />,
    );

    await waitFor(() => expect(fetchLegalMovesMock).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('square-e2'));
    await waitFor(() => expect(screen.getByTestId('target-e4')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('square-e4'));

    await waitFor(() => expect(onCursorChange).toHaveBeenCalledWith(5));
    expect(screen.getByTestId('square-e2')).not.toHaveTextContent('♟');
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♟');

    const echoed: GameNode = {
      id: 5,
      ply: 1,
      san: 'e4',
      from: 'e2',
      to: 'e4',
      promotion: null,
      comment: null,
      nags: [],
      status: 'active',
      fen: startMoves[0].fen,
      children: [],
    };
    rerender(
      <Analysis
        tree={{ ...tree, root: { ...tree.root, children: [...tree.root.children, echoed] } }}
        presenterId="p1"
        selfId="p1"
        onCursorChange={onCursorChange}
      />,
    );

    expect(screen.getByTestId('square-e2')).not.toHaveTextContent('♟');
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♟');
  });

  it('lets an editor save a comment on the current position via the note popup', () => {
    const onComment = vi.fn();
    render(<Analysis tree={tree} canEdit onPlayMove={vi.fn()} onComment={onComment} />);

    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    fireEvent.change(screen.getByTestId('comment-editor'), {
      target: { value: 'Nice idea' },
    });
    fireEvent.click(screen.getByTestId('save-comment'));

    expect(onComment).toHaveBeenCalledWith({ ply: 0, text: 'Nice idea', node_id: 0 });
    expect(screen.queryByTestId('comment-editor')).not.toBeInTheDocument();
  });

  it('shows the saved comment in the bubble after the echo applies it', () => {
    const onComment = vi.fn();
    const { rerender } = render(
      <Analysis tree={tree} canEdit onPlayMove={vi.fn()} onComment={onComment} />,
    );

    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.keyDown(document.body, { key: 'c' });
    fireEvent.change(screen.getByTestId('comment-editor'), {
      target: { value: 'Nice idea' },
    });
    fireEvent.click(screen.getByTestId('save-comment'));

    rerender(
      <Analysis
        tree={{ ...tree, root: { ...tree.root, comment: 'Nice idea' } }}
        canEdit
        onPlayMove={vi.fn()}
        onComment={onComment}
      />,
    );

    expect(screen.getByTestId('comment-bubble')).toHaveTextContent('Nice idea');
  });

  it('does not offer the note popup to viewers, but shows existing comments in the bubble', () => {
    render(<Analysis tree={tree} presenterId="p1" selfId="me" />);

    expect(screen.queryByRole('button', { name: 'Comment' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('analysis-move-3'));
    expect(screen.getByTestId('comment-bubble')).toHaveTextContent('Sicilian');
  });

  it('shows no bubble to viewers when the position has no comment', () => {
    render(<Analysis tree={tree} presenterId="p1" selfId="me" />);

    expect(screen.queryByTestId('comment-bubble')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comment-editor')).not.toBeInTheDocument();
  });
});

describe('follow-the-tail cursor', () => {
  const c4Node: GameNode = {
    id: 5,
    ply: 1,
    san: 'c4',
    from: 'c2',
    to: 'c4',
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    fen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1',
    children: [],
  };
  const treeWithC4: GameTree = {
    ...tree,
    root: { ...tree.root, children: [...tree.root.children, c4Node] },
  };

  it('advances when a remote move is played from my current position', () => {
    const { rerender } = render(<Analysis tree={tree} lastPlayedId={4} />);
    expect(screen.getByTestId('square-f3')).toHaveTextContent('♞');

    fireEvent.keyDown(document.body, { key: 'Home' });
    expect(screen.getByTestId('square-g1')).toHaveTextContent('♞');

    rerender(<Analysis tree={treeWithC4} lastPlayedId={5} />);
    expect(screen.getByTestId('square-c4')).toHaveTextContent('♟');
  });

  it('does not bounce forward when navigating back to the parent of the last move', () => {
    render(<Analysis tree={tree} lastPlayedId={4} />);
    // At the tip (Nf3, id 4); its parent is e5 (id 2).
    expect(screen.getByTestId('square-f3')).toHaveTextContent('♞');

    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(screen.getByTestId('square-f3')).not.toHaveTextContent('♞');
    expect(screen.getByTestId('square-e5')).toHaveTextContent('♟');

    // Still there a moment later — no bounce back to the tip.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByTestId('square-f3')).toHaveTextContent('♞');
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(screen.getByTestId('square-e5')).toHaveTextContent('♟');
  });

  it('stays put when a remote move lands somewhere I am not looking at', () => {
    const { rerender } = render(<Analysis tree={tree} lastPlayedId={4} />);
    expect(screen.getByTestId('square-f3')).toHaveTextContent('♞');

    rerender(<Analysis tree={treeWithC4} lastPlayedId={5} />);
    expect(screen.getByTestId('square-c4')).not.toHaveTextContent('♟');
    expect(screen.getByTestId('square-f3')).toHaveTextContent('♞');
  });
});

describe('analysis settings tab', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const RESULT = {
    score: { type: 'cp', cp: 42 } as const,
    depth: 9,
    pv: ['e2e4'],
    bestMove: 'e2e4',
  };

  function makeEngine() {
    return {
      init: vi.fn(() => Promise.resolve()),
      analyze: vi.fn(async () => RESULT),
      terminate: vi.fn(),
    };
  }

  it('turns the engine display off and on from the settings tab', async () => {
    render(<Analysis tree={tree} engine={makeEngine()} />);
    expect(await screen.findByTestId('engine-readout')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    fireEvent.click(screen.getByTestId('setting-engine'));

    await waitFor(() => expect(screen.queryByTestId('engine-readout')).not.toBeInTheDocument());
    expect(screen.queryByTestId('eval-bar')).not.toBeInTheDocument();
    // The board's left slot keeps its width so the layout doesn't shift.
    expect(screen.getByTestId('board-left-slot')).toBeInTheDocument();
    expect(localStorage.getItem('blunderfest.engine')).toBe('off');

    fireEvent.click(screen.getByTestId('setting-engine'));
    expect(await screen.findByTestId('engine-readout')).toBeInTheDocument();
  });

  it('turns only the hint arrows off from the settings tab', async () => {
    render(<Analysis tree={tree} engine={makeEngine()} />);
    expect(await screen.findByTestId('board-arrows')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    fireEvent.click(screen.getByTestId('setting-arrows'));

    await waitFor(() => expect(screen.queryByTestId('board-arrows')).not.toBeInTheDocument());
    // The rest of the engine display stays on.
    expect(screen.getByTestId('engine-readout')).toBeInTheDocument();
    expect(localStorage.getItem('blunderfest.hints')).toBe('off');
  });
});

describe('engine analysis', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function fakeEngine(
    result: {
      score: { type: 'cp'; cp: number } | { type: 'mate'; mate: number };
      depth: number;
      pv: string[];
      bestMove: string;
    } | null,
  ): {
    init: ReturnType<typeof vi.fn>;
    analyze: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  } {
    return {
      init: vi.fn(() => Promise.resolve()),
      analyze: vi.fn(async () => result),
      terminate: vi.fn(),
    };
  }

  it('shows the eval bar, label and hint arrow once the engine has analyzed the position', async () => {
    render(
      <Analysis
        tree={tree}
        engine={fakeEngine({
          score: { type: 'cp', cp: 42 },
          depth: 9,
          pv: ['e2e4'],
          bestMove: 'e2e4',
        })}
      />,
    );

    expect(await screen.findByTestId('engine-eval-badge')).toHaveTextContent('-0.42');
    expect(await screen.findByTestId('board-arrows')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Black is better by 0.42 pawns' })).toBeInTheDocument();
    expect(screen.getByTestId('engine-readout')).toHaveTextContent('Depth 9');
  });

  it('shows no hint when the engine reports no best move', async () => {
    render(<Analysis tree={tree} engine={fakeEngine(null)} />);

    await waitFor(() => expect(screen.queryByText('Analyzing...')).not.toBeInTheDocument());
    expect(screen.queryByTestId('board-arrows')).not.toBeInTheDocument();
  });

  it('reports when the engine is unavailable', async () => {
    const engine = {
      init: vi.fn(() => Promise.resolve()),
      analyze: vi.fn(() => Promise.reject(new Error('boom'))),
      terminate: vi.fn(),
    };
    render(<Analysis tree={tree} engine={engine} />);

    expect(await screen.findByText('Engine analysis unavailable')).toBeInTheDocument();
  });
});

describe('position setup (what-if editing)', () => {
  beforeEach(() => {
    fetchLegalMovesMock.mockReset();
    fetchLegalMovesMock.mockResolvedValue({ moves: [] });
  });

  it('lets an editor move a piece anywhere and set the position', () => {
    const onSetPosition = vi.fn();
    render(<Analysis tree={tree} canEdit onSetPosition={onSetPosition} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit position' }));
    fireEvent.click(screen.getByTestId('square-e4'));
    fireEvent.click(screen.getByTestId('square-h3'));
    fireEvent.click(screen.getByTestId('set-position-button'));

    expect(onSetPosition).toHaveBeenCalledTimes(1);
    const payload = onSetPosition.mock.calls[0][0];
    expect(payload.parent_id).toBe(4);
    expect(payload.fen).toContain('5N1P');
    expect(payload.fen).toContain(' b ');
    // The pending setup node shows the edited position immediately.
    expect(screen.getByTestId('square-h3')).toHaveTextContent('♟');
    expect(screen.getByTestId('square-e4')).not.toHaveTextContent('♟');
  });

  it('rejects an illegal setup and keeps editing', () => {
    const onSetPosition = vi.fn();
    render(<Analysis tree={tree} canEdit onSetPosition={onSetPosition} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit position' }));
    // Replace the black king with the white pawn — no black king left.
    fireEvent.click(screen.getByTestId('square-e4'));
    fireEvent.click(screen.getByTestId('square-e8'));
    fireEvent.click(screen.getByTestId('set-position-button'));

    expect(screen.getByRole('alert')).toHaveTextContent(/isn't legal/);
    expect(onSetPosition).not.toHaveBeenCalled();
  });

  it('does not offer edit mode without edit rights', () => {
    render(<Analysis tree={tree} />);
    expect(screen.queryByRole('button', { name: 'Edit position' })).not.toBeInTheDocument();
  });
  it('places pieces from the palette, clears and resets the board, and pauses the engine', () => {
    const onSetPosition = vi.fn();
    render(<Analysis tree={tree} canEdit onSetPosition={onSetPosition} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit position' }));
    expect(screen.getByTestId('engine-paused')).toBeInTheDocument();
    expect(screen.queryByTestId('engine-readout')).not.toBeInTheDocument();

    // Clear everything, then place a white king on a4 from the palette.
    fireEvent.click(screen.getByTestId('edit-clear-button'));
    expect(screen.getByTestId('square-e4')).not.toHaveTextContent('♟');
    fireEvent.click(screen.getByRole('button', { name: 'White king' }));
    fireEvent.click(screen.getByTestId('square-a4'));
    expect(screen.getByTestId('square-a4')).toHaveTextContent('♚');

    // Reset restores the node's position.
    fireEvent.click(screen.getByTestId('edit-reset-button'));
    expect(screen.getByTestId('square-a4')).not.toHaveTextContent('♚');
    expect(screen.getByTestId('square-e4')).toHaveTextContent('♟');

    // The eraser removes a single piece.
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    fireEvent.click(screen.getByTestId('square-e4'));
    expect(screen.getByTestId('square-e4')).not.toHaveTextContent('♟');
  });
});
