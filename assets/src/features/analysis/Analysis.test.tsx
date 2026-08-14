import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function pieceAt(testId: string): string | null {
  return (
    screen.getByTestId(testId).querySelector('[data-piece]')?.getAttribute('data-piece') ?? null
  );
}

describe('Analysis', () => {
  it('opens on the latest mainline position (so a refresh restores the game state)', () => {
    renderAnalysis();

    expect(pieceAt('square-f3')).toBe('wn');
    expect(pieceAt('square-g1')).toBeNull();
    expect(pieceAt('square-e4')).toBe('wp');
  });

  it('opens on the initial position with startAtRoot (a freshly imported game)', () => {
    render(<Analysis tree={tree} startAtRoot />);

    expect(pieceAt('square-e2')).toBe('wp');
    expect(pieceAt('square-e4')).toBeNull();
    expect(pieceAt('square-f3')).toBeNull();
  });

  it('navigates forward and backward with the buttons', () => {
    renderAnalysis();

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(pieceAt('square-e4')).toBe('wp');
    expect(pieceAt('square-e2')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(pieceAt('square-e5')).toBe('bp');

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(pieceAt('square-e5')).toBeNull();
  });

  it('jumps to first and last moves', () => {
    renderAnalysis();

    fireEvent.click(screen.getByRole('button', { name: 'Last' }));
    expect(pieceAt('square-f3')).toBe('wn');
    expect(screen.getByTestId('analysis-move-4')).toHaveAttribute('aria-current', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    expect(pieceAt('square-g1')).toBe('wn');
  });

  it('clicks a variation in the move list', () => {
    renderAnalysis();

    fireEvent.click(screen.getByTestId('analysis-move-3'));
    expect(pieceAt('square-c5')).toBe('bp');
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
    expect(pieceAt('square-e4')).toBe('wp');

    fireEvent.keyDown(root(), { key: 'ArrowLeft' });
    expect(pieceAt('square-e4')).toBeNull();
  });

  it('navigates with the arrow keys even when focus is outside the analysis region', () => {
    renderAnalysis();

    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(pieceAt('square-e4')).toBe('wp');
  });

  it('navigates the game with arrows after clicking a square (clicks never focus the board)', () => {
    render(<Analysis tree={tree} canEdit onPlayMove={vi.fn()} />);

    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.click(screen.getByTestId('square-e2'));
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(pieceAt('square-e4')).toBe('wp');
  });

  it('ignores the navigation keys while typing in the comment editor', () => {
    render(<Analysis tree={tree} canEdit onComment={vi.fn()} />);

    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.keyDown(document.body, { key: 'c' });
    fireEvent.keyDown(screen.getByTestId('comment-editor'), { key: 'ArrowRight' });
    expect(pieceAt('square-e4')).toBeNull();
  });

  it('ignores the navigation keys when a modifier is held', () => {
    renderAnalysis();

    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight', ctrlKey: true });
    expect(pieceAt('square-e4')).toBeNull();
  });

  it('shows the fallback screen when no game is loaded', () => {
    render(<Analysis tree={null} />);

    expect(screen.getByText('Import a game to start analyzing.')).toBeInTheDocument();
  });

  it('jumps with Home and End keys', () => {
    renderAnalysis();
    const root = () => screen.getByTestId('analysis-root');

    fireEvent.keyDown(root(), { key: 'End' });
    expect(pieceAt('square-f3')).toBe('wn');

    fireEvent.keyDown(root(), { key: 'Home' });
    expect(pieceAt('square-g1')).toBe('wn');
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

    expect(pieceAt('square-e5')).toBe('bp');
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
    expect(pieceAt('square-e5')).toBe('bp');
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
    expect(pieceAt('square-e4')).toBe('wp');
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

    // Re-following is driven by the parent (the follow toggle lives in the
    // member list); once `following` flips back, the presenter cursor wins.
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
    expect(pieceAt('square-f3')).toBe('wn');
  });

  it('broadcasts navigation while presenting', () => {
    const onCursorChange = vi.fn();
    render(<Analysis tree={tree} presenterId="p1" selfId="p1" onCursorChange={onCursorChange} />);

    expect(onCursorChange).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onCursorChange).toHaveBeenCalledWith(2);
  });

  it('lets an editor play a move from the board', async () => {
    const onPlayMove = vi.fn();
    render(<Analysis tree={tree} presenterId="p1" selfId="p1" canEdit onPlayMove={onPlayMove} />);

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    fireEvent.click(screen.getByTestId('square-e2'));

    expect(screen.getByTestId('selected-e2')).toBeInTheDocument();
    expect(screen.getByTestId('target-e4')).toBeInTheDocument();
    expect(screen.getByTestId('target-e3')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('square-e4'));

    await waitFor(() => expect(onPlayMove).toHaveBeenCalledTimes(1));
    expect(onPlayMove).toHaveBeenCalledWith(
      {
        ply: 1,
        san: 'e4',
        from: 'e2',
        to: 'e4',
        promotion: null,
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        status: 'active',
        parent_id: tree.root.id,
      },
      expect.any(Function),
    );
  });

  it('does not let viewers play moves', () => {
    const onPlayMove = vi.fn();
    render(<Analysis tree={tree} presenterId="p1" selfId="me" onPlayMove={onPlayMove} />);

    fireEvent.click(screen.getByTestId('square-e2'));
    fireEvent.click(screen.getByTestId('square-e4'));

    expect(onPlayMove).not.toHaveBeenCalled();
  });

  it('lets a collaborator play moves without presenting or broadcasting the cursor', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    fireEvent.click(screen.getByTestId('square-e2'));
    await waitFor(() => expect(screen.getByTestId('target-e4')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('square-e4'));

    await waitFor(() => expect(onPlayMove).toHaveBeenCalledTimes(1));
    expect(onCursorChange).not.toHaveBeenCalled();
  });

  it('stays on a played move before and after the echo applies it', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    fireEvent.click(screen.getByTestId('square-e2'));
    await waitFor(() => expect(screen.getByTestId('target-e4')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('square-e4'));

    await waitFor(() => expect(onCursorChange).toHaveBeenCalledWith(5));
    expect(pieceAt('square-e2')).toBeNull();
    expect(pieceAt('square-e4')).toBe('wp');

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
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
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

    expect(pieceAt('square-e2')).toBeNull();
    expect(pieceAt('square-e4')).toBe('wp');
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

describe('board annotations', () => {
  function pointerOn(grid: HTMLElement, type: string, init: MouseEventInit = {}) {
    fireEvent(grid, new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
  }

  function stubBoardRect() {
    const grid = document.querySelector('[data-board-grid]') as HTMLElement;
    grid.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 800,
        height: 800,
        right: 800,
        bottom: 800,
        x: 0,
        y: 0,
      }) as DOMRect;
    return grid;
  }

  it('removes an arrow by drawing the same arrow again', () => {
    const onAnnotations = vi.fn();
    render(
      <Analysis
        tree={tree}
        canEdit
        lastPlayedId={4}
        annotations={{
          4: { arrows: [{ from: 'e2', to: 'e4', color: '#3b82f6' }], highlights: [] },
        }}
        onAnnotations={onAnnotations}
      />,
    );

    const grid = stubBoardRect();
    pointerOn(grid, 'pointerdown', { button: 2, clientX: 450, clientY: 650 });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 450, clientY: 450 }));
    fireEvent(window, new MouseEvent('pointerup', { button: 2, clientX: 450, clientY: 450 }));

    expect(onAnnotations).toHaveBeenCalledWith({ arrows: [], highlights: [] }, 4);
  });

  it("clears the current node's drawings with Escape", () => {
    const onAnnotations = vi.fn();
    render(
      <Analysis
        tree={tree}
        canEdit
        annotations={{
          4: { arrows: [{ from: 'e2', to: 'e4', color: '#3b82f6' }], highlights: [] },
        }}
        onAnnotations={onAnnotations}
        lastPlayedId={4}
      />,
    );

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onAnnotations).toHaveBeenCalledWith({ arrows: [], highlights: [] }, 4);
  });

  it('does not clear with Escape when nothing is drawn', () => {
    const onAnnotations = vi.fn();
    render(<Analysis tree={tree} canEdit onAnnotations={onAnnotations} lastPlayedId={4} />);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onAnnotations).not.toHaveBeenCalled();
  });

  it('clears drawings via the clear button (the mobile stand-in for Escape)', () => {
    const onAnnotations = vi.fn();
    render(
      <Analysis
        tree={tree}
        canEdit
        annotations={{
          4: { arrows: [{ from: 'e2', to: 'e4', color: '#3b82f6' }], highlights: [] },
        }}
        onAnnotations={onAnnotations}
        lastPlayedId={4}
      />,
    );

    const button = screen.getByTestId('clear-drawings-button');
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onAnnotations).toHaveBeenCalledWith({ arrows: [], highlights: [] }, 4);
  });

  it('disables the clear button when nothing is drawn', () => {
    render(<Analysis tree={tree} canEdit onAnnotations={vi.fn()} lastPlayedId={4} />);

    expect(screen.getByTestId('clear-drawings-button')).toBeDisabled();
  });

  it('hides the clear button from viewers', () => {
    render(<Analysis tree={tree} onAnnotations={vi.fn()} lastPlayedId={4} />);

    expect(screen.queryByTestId('clear-drawings-button')).not.toBeInTheDocument();
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
    expect(pieceAt('square-f3')).toBe('wn');

    fireEvent.keyDown(document.body, { key: 'Home' });
    expect(pieceAt('square-g1')).toBe('wn');

    rerender(<Analysis tree={treeWithC4} lastPlayedId={5} />);
    expect(pieceAt('square-c4')).toBe('wp');
  });

  it('does not bounce forward when navigating back to the parent of the last move', () => {
    render(<Analysis tree={tree} lastPlayedId={4} />);
    // At the tip (Nf3, id 4); its parent is e5 (id 2).
    expect(pieceAt('square-f3')).toBe('wn');

    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(pieceAt('square-f3')).toBeNull();
    expect(pieceAt('square-e5')).toBe('bp');

    // Still there a moment later — no bounce back to the tip.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(pieceAt('square-f3')).toBe('wn');
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(pieceAt('square-e5')).toBe('bp');
  });

  it('stays put when a remote move lands somewhere I am not looking at', () => {
    const { rerender } = render(<Analysis tree={tree} lastPlayedId={4} />);
    expect(pieceAt('square-f3')).toBe('wn');

    rerender(<Analysis tree={treeWithC4} lastPlayedId={5} />);
    expect(pieceAt('square-c4')).toBeNull();
    expect(pieceAt('square-f3')).toBe('wn');
  });
});

describe('game flow chart', () => {
  const flowEvals = [
    { ply: 0, score: { cp: 20 }, best_move: null },
    { ply: 1, score: { cp: 40 }, best_move: null },
    { ply: 2, score: { cp: -30 }, best_move: null },
    { ply: 3, score: { cp: 10 }, best_move: null },
  ];

  it('shows the chart once an analysis exists and jumps to the clicked ply', () => {
    render(<Analysis tree={tree} analysis={flowEvals} />);
    const chart = screen.getByTestId('game-flow');
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      height: 64,
      right: 100,
      bottom: 64,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    // Opens on the last mainline position (3. Nf3).
    expect(pieceAt('square-f3')).toBe('wn');

    // 25% across → ply 1: 1. e4 played, 1... e5 not yet.
    fireEvent(chart, new MouseEvent('pointerdown', { bubbles: true, clientX: 25 }));
    expect(pieceAt('square-e4')).toBe('wp');
    expect(pieceAt('square-e5')).toBeNull();
    expect(pieceAt('square-f3')).toBeNull();
  });

  it('stays hidden without an analysis', () => {
    renderAnalysis();

    expect(screen.queryByTestId('game-flow')).not.toBeInTheDocument();
  });

  it('shows the material tab even without an analysis (no engine needed)', () => {
    renderAnalysis();

    expect(screen.getByRole('tab', { name: 'Material' })).toBeInTheDocument();
  });

  it('holds the chart slot with the analyze button until an analysis exists', () => {
    const onAnalyze = vi.fn();
    render(<Analysis tree={tree} onAnalyze={onAnalyze} />);

    expect(screen.queryByTestId('game-flow')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze game' }));
    expect(onAnalyze).toHaveBeenCalledTimes(1);
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
    // The bar's slot leaves the flow entirely — it hangs off the board's
    // left edge when shown, so the board never shifts either way.
    expect(screen.queryByTestId('board-left-slot')).not.toBeInTheDocument();
    expect(localStorage.getItem('blunderfest.engine')).toBe('off');

    fireEvent.click(screen.getByTestId('setting-engine'));
    expect(await screen.findByTestId('engine-readout')).toBeInTheDocument();
    expect(await screen.findByTestId('board-left-slot')).toBeInTheDocument();
  });

  it('disables the hint-arrow switch while the engine is off (not the reverse)', async () => {
    render(<Analysis tree={tree} engine={makeEngine()} />);
    expect(await screen.findByTestId('board-arrows')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    const arrowsSwitch = screen.getByTestId('setting-arrows');
    expect(arrowsSwitch).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('setting-engine'));
    await waitFor(() => expect(screen.getByTestId('setting-arrows')).toBeDisabled());
    // Engine off hides everything, arrows preference is kept but inert.
    await waitFor(() => expect(screen.queryByTestId('board-arrows')).not.toBeInTheDocument());
    expect(localStorage.getItem('blunderfest.hints')).not.toBe('off');

    // Re-enabling the engine restores the arrows.
    fireEvent.click(screen.getByTestId('setting-engine'));
    await waitFor(() => expect(screen.getByTestId('setting-arrows')).not.toBeDisabled());
    expect(await screen.findByTestId('board-arrows')).toBeInTheDocument();
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
    expect(pieceAt('square-h3')).toBe('wp');
    expect(pieceAt('square-e4')).toBeNull();
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

  it('places a palette piece by dragging it onto the board', () => {
    const onSetPosition = vi.fn();
    render(<Analysis tree={tree} canEdit onSetPosition={onSetPosition} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit position' }));
    const grid = document.querySelector('[data-board-grid]') as HTMLElement;
    grid.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 800,
        height: 800,
        right: 800,
        bottom: 800,
        x: 0,
        y: 0,
      }) as DOMRect;

    fireEvent(
      screen.getByRole('button', { name: 'White king' }),
      new MouseEvent('pointerdown', { button: 0, bubbles: true }),
    );
    // The drag paints the square as it is entered; release only ends it.
    fireEvent(window, new MouseEvent('pointermove', { clientX: 50, clientY: 450 }));
    fireEvent(window, new MouseEvent('pointerup', { clientX: 50, clientY: 450 }));

    expect(pieceAt('square-a4')).toBe('wk');
  });

  it('sweep-paints several squares in one drag from the palette', () => {
    render(<Analysis tree={tree} canEdit onSetPosition={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit position' }));
    const grid = document.querySelector('[data-board-grid]') as HTMLElement;
    grid.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 800,
        height: 800,
        right: 800,
        bottom: 800,
        x: 0,
        y: 0,
      }) as DOMRect;

    fireEvent(
      screen.getByRole('button', { name: 'Black rook' }),
      new MouseEvent('pointerdown', { button: 0, bubbles: true }),
    );
    fireEvent(window, new MouseEvent('pointermove', { clientX: 50, clientY: 450 }));
    fireEvent(window, new MouseEvent('pointermove', { clientX: 150, clientY: 450 }));
    fireEvent(window, new MouseEvent('pointermove', { clientX: 250, clientY: 450 }));
    fireEvent(window, new MouseEvent('pointerup', { clientX: 250, clientY: 450 }));

    expect(pieceAt('square-a4')).toBe('br');
    expect(pieceAt('square-b4')).toBe('br');
    expect(pieceAt('square-c4')).toBe('br');
  });

  it('paints on the board on press and paints more while sweeping', () => {
    render(<Analysis tree={tree} canEdit onSetPosition={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit position' }));
    const grid = document.querySelector('[data-board-grid]') as HTMLElement;
    grid.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 800,
        height: 800,
        right: 800,
        bottom: 800,
        x: 0,
        y: 0,
      }) as DOMRect;

    // Select the white queen with a palette press, then press-sweep a4→c4.
    fireEvent(
      screen.getByRole('button', { name: 'White queen' }),
      new MouseEvent('pointerdown', { button: 0, bubbles: true }),
    );
    fireEvent(window, new MouseEvent('pointerup', {}));

    fireEvent(grid, new MouseEvent('pointerdown', { clientX: 50, clientY: 450, bubbles: true }));
    fireEvent(grid, new MouseEvent('pointermove', { clientX: 150, clientY: 450, bubbles: true }));
    fireEvent(grid, new MouseEvent('pointermove', { clientX: 250, clientY: 450, bubbles: true }));
    fireEvent(window, new MouseEvent('pointerup', {}));

    expect(pieceAt('square-a4')).toBe('wq');
    expect(pieceAt('square-b4')).toBe('wq');
    expect(pieceAt('square-c4')).toBe('wq');
  });

  it('selects a piece on tap and places it on multiple squares', () => {
    render(<Analysis tree={tree} canEdit onSetPosition={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit position' }));
    const kingButton = screen.getByRole('button', { name: 'White king' });

    // A tap (pointerdown + up with no movement, then the synthesized
    // click) selects the piece...
    fireEvent(kingButton, new MouseEvent('pointerdown', { button: 0, bubbles: true }));
    fireEvent(window, new MouseEvent('pointerup', {}));
    fireEvent.click(kingButton);
    expect(screen.queryByTestId('palette-ghost')).not.toBeInTheDocument();
    expect(kingButton).toHaveAttribute('aria-pressed', 'true');

    // ...and places a copy on every square tapped.
    fireEvent.click(screen.getByTestId('square-a4'));
    fireEvent.click(screen.getByTestId('square-b5'));
    expect(pieceAt('square-a4')).toBe('wk');
    expect(pieceAt('square-b5')).toBe('wk');

    // Tapping the palette piece again deselects it.
    fireEvent.click(kingButton);
    expect(kingButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('drops the drag ghost without placing when the pointer is canceled (page scrolls)', () => {
    render(<Analysis tree={tree} canEdit onSetPosition={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit position' }));
    fireEvent(
      screen.getByRole('button', { name: 'White king' }),
      new MouseEvent('pointerdown', { button: 0, bubbles: true }),
    );
    fireEvent(window, new MouseEvent('pointermove', { clientX: 30, clientY: 100 }));
    expect(screen.getByTestId('palette-ghost')).toBeInTheDocument();

    // The browser hijacks the gesture to scroll: pointercancel, no pointerup.
    fireEvent(window, new MouseEvent('pointercancel', {}));

    expect(screen.queryByTestId('palette-ghost')).not.toBeInTheDocument();
    expect(pieceAt('square-a4')).toBeNull();
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
    expect(pieceAt('square-e4')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'White king' }));
    fireEvent.click(screen.getByTestId('square-a4'));
    expect(pieceAt('square-a4')).toBe('wk');

    // Reset restores the node's position.
    fireEvent.click(screen.getByTestId('edit-reset-button'));
    expect(pieceAt('square-a4')).toBeNull();
    expect(pieceAt('square-e4')).toBe('wp');

    // The eraser removes a single piece.
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    fireEvent.click(screen.getByTestId('square-e4'));
    expect(pieceAt('square-e4')).toBeNull();
  });
});
