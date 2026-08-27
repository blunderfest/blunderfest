import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TimelineBand from '@/features/analysis/TimelineBand';
import type { GameNode, GameTree } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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

const tree: GameTree = {
  headers: { White: 'Alice', Black: 'Bob' },
  result: '*',
  setup: null,
  mainline_ply_count: 3,
  node_count: 4,
  root: node({
    id: 0,
    ply: 0,
    san: null,
    children: [
      node({
        id: 1,
        ply: 1,
        san: 'e4',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        children: [
          node({
            id: 2,
            ply: 2,
            san: 'e5',
            fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
          }),
        ],
      }),
    ],
  }),
};

/** Evals stop at ply 2 while the mainline runs to ply 3 (stale analysis). */
const evals: AnalysisEval[] = [
  { ply: 0, score: { cp: 20 }, best_move: null },
  { ply: 1, score: { cp: 40 }, best_move: null },
  { ply: 2, score: { cp: -30 }, best_move: null },
];

const analyzeAction = {
  label: 'Analyze game',
  progress: null,
  onClick: vi.fn(),
};

/**
 * Renders the band expanded (the stacked layer view): most assertions below
 * target the layers, and the strip is covered by its own describe block.
 */
function renderBand(overrides: Partial<Parameters<typeof TimelineBand>[0]> = {}) {
  localStorage.setItem('blunderfest.timelineExpanded', '1');
  return render(
    <TimelineBand
      tree={tree}
      evals={evals}
      currentPly={2}
      spanPly={3}
      hasAnalysis
      analyzeAction={null}
      onSelectPly={vi.fn()}
      {...overrides}
    />,
  );
}

function layerToggle(id: string): HTMLElement {
  // The layer toggles live in the "Layers" popover — open it once.
  const popoverButton = screen.getByTestId('timeline-layers-button');
  if (popoverButton.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(popoverButton);
  }
  const toggle = screen
    .getAllByTestId('timeline-layer-toggle')
    .find((button) => button.dataset.layer === id);
  if (toggle === undefined) {
    throw new Error(`No toggle for layer ${id}`);
  }
  return toggle;
}

describe('TimelineBand', () => {
  afterEach(() => {
    localStorage.removeItem('blunderfest.timelineLayers');
    localStorage.removeItem('blunderfest.timelineExpanded');
  });

  it('renders the eval and material layers by default', () => {
    renderBand();

    expect(screen.getByTestId('game-flow')).toBeInTheDocument();
    expect(screen.getByTestId('material-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-flow')).not.toBeInTheDocument();
  });

  it('marks the eval chip as needing an analysis until one exists', () => {
    renderBand({ hasAnalysis: false });

    expect(layerToggle('eval')).toHaveAttribute(
      'title',
      'This layer needs an analysis — run “Analyze game”.',
    );
    expect(screen.getByTestId('eval-layer-needs-analysis')).toBeInTheDocument();
  });

  it('drops the eval chip marker once an analysis exists', () => {
    renderBand({ hasAnalysis: true });

    layerToggle('eval');
    expect(screen.queryByTestId('eval-layer-needs-analysis')).not.toBeInTheDocument();
  });

  it('aligns every layer on the shared span, not each chart\u2019s own last ply', () => {
    // Both charts' own data ends at ply 2; the shared span is 4. The
    // current ply (2) must sit at the halfway line of both — without the
    // span each chart would put it at its own right edge.
    renderBand({ currentPly: 2, spanPly: 4 });

    expect(screen.getByTestId('game-flow-marker')).toHaveAttribute('x1', '50');
    expect(screen.getByTestId('material-flow-marker')).toHaveAttribute('x1', '50');
  });

  it('holds the analyze action in the header, eval layer explains itself', () => {
    renderBand({ hasAnalysis: false, analyzeAction });

    // The button rides the header — no layer has to be on to reach it.
    const headerButton = screen.getByRole('button', { name: 'Analyze game' });
    fireEvent.click(headerButton);
    expect(analyzeAction.onClick).toHaveBeenCalledTimes(1);
    // The eval layer itself is a note, not a button.
    expect(screen.queryByTestId('game-flow')).not.toBeInTheDocument();
    expect(screen.getByTestId('timeline-layer-eval')).toHaveTextContent('No analysis yet');
    // The pure-FEN layer still charts.
    expect(screen.getByTestId('material-flow')).toBeInTheDocument();
  });

  it('hides the header action once an analysis exists (even with the eval layer off)', () => {
    renderBand({ hasAnalysis: true });

    expect(screen.queryByRole('button', { name: 'Analyze game' })).not.toBeInTheDocument();

    // With every layer off, the header still renders (chips + no button).
    fireEvent.click(layerToggle('eval'));
    fireEvent.click(layerToggle('material'));
    expect(screen.getByTestId('timeline-band-empty')).toBeInTheDocument();
  });

  it('captions every visible layer with its label', () => {
    renderBand();

    expect(screen.getByTestId('timeline-layer-eval')).toHaveTextContent('Eval');
    expect(screen.getByTestId('timeline-layer-material')).toHaveTextContent('Material');
  });

  it('explains the clocks bar colors with a side legend', () => {
    renderBand();

    fireEvent.click(layerToggle('clocks'));
    const layer = screen.getByTestId('timeline-layer-clocks');
    expect(layer).toHaveTextContent('White');
    expect(layer).toHaveTextContent('Black');
  });

  it('toggles a layer off and on, persisting the choice', () => {
    renderBand();

    fireEvent.click(layerToggle('material'));
    expect(screen.queryByTestId('material-flow')).not.toBeInTheDocument();
    expect(localStorage.getItem('blunderfest.timelineLayers')).toBe('["eval"]');

    fireEvent.click(layerToggle('activity'));
    expect(screen.getByTestId('activity-flow')).toBeInTheDocument();
    expect(localStorage.getItem('blunderfest.timelineLayers')).toBe('["eval","activity"]');
  });

  it('honors a stored layer choice from a previous session', () => {
    localStorage.setItem('blunderfest.timelineLayers', '["activity"]');

    renderBand();

    expect(screen.getByTestId('activity-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('game-flow')).not.toBeInTheDocument();
    expect(screen.queryByTestId('material-flow')).not.toBeInTheDocument();
  });

  it('shows a hint when every layer is off', () => {
    renderBand();

    fireEvent.click(layerToggle('eval'));
    fireEvent.click(layerToggle('material'));

    expect(screen.getByTestId('timeline-band-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('game-flow')).not.toBeInTheDocument();
  });
});

describe('TimelineBand strip (collapsed)', () => {
  afterEach(() => {
    localStorage.removeItem('blunderfest.timelineLayers');
    localStorage.removeItem('blunderfest.timelineExpanded');
  });

  function renderStrip(overrides: Partial<Parameters<typeof TimelineBand>[0]> = {}) {
    return render(
      <TimelineBand
        tree={tree}
        evals={evals}
        currentPly={2}
        spanPly={3}
        hasAnalysis
        analyzeAction={null}
        onSelectPly={vi.fn()}
        {...overrides}
      />,
    );
  }

  it('is the default: one sparkline layer — the first enabled layer holding data', () => {
    renderStrip();

    expect(screen.getByTestId('timeline-strip')).toBeInTheDocument();
    expect(screen.getByTestId('game-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('material-flow')).not.toBeInTheDocument();
    expect(screen.getByTestId('timeline-strip-caption')).toHaveTextContent('Eval');
    expect(screen.queryByTestId('timeline-layer-eval')).not.toBeInTheDocument();
  });

  it('skips layers without data (the eval chart needs an analysis)', () => {
    renderStrip({ hasAnalysis: false });

    expect(screen.queryByTestId('game-flow')).not.toBeInTheDocument();
    expect(screen.getByTestId('material-flow')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-strip-caption')).toHaveTextContent('Material');
  });

  it('shows a compact note when no enabled layer holds data', () => {
    const emptyTree: GameTree = {
      ...tree,
      mainline_ply_count: 0,
      root: { ...tree.root, children: [] },
    };
    renderStrip({ tree: emptyTree, hasAnalysis: false, spanPly: 0, currentPly: 0 });

    expect(screen.getByTestId('timeline-strip-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('material-flow')).not.toBeInTheDocument();
  });

  it('expands to the stacked layers and persists the choice', () => {
    renderStrip();

    fireEvent.click(screen.getByTestId('timeline-expand'));

    expect(screen.getByTestId('timeline-layer-eval')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-layer-material')).toBeInTheDocument();
    expect(localStorage.getItem('blunderfest.timelineExpanded')).toBe('1');
  });

  it('keeps the analyze action reachable while collapsed', () => {
    const action = { label: 'Analyze game', progress: null, onClick: vi.fn() };
    renderStrip({ hasAnalysis: false, analyzeAction: action });

    fireEvent.click(screen.getByRole('button', { name: 'Analyze game' }));
    expect(action.onClick).toHaveBeenCalledTimes(1);
  });
});
