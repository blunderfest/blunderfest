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

function renderBand(overrides: Partial<Parameters<typeof TimelineBand>[0]> = {}) {
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

/** A layer's tab in the header. */
function layerTab(id: string): HTMLElement {
  const tab = screen
    .getAllByTestId('timeline-layer-tab')
    .find((button) => button.dataset.layer === id);
  if (tab === undefined) {
    throw new Error(`No tab for layer ${id}`);
  }
  return tab;
}

describe('TimelineBand', () => {
  afterEach(() => {
    localStorage.removeItem('blunderfest.timelineActiveLayer');
  });

  it('shows the eval layer by default, one chart at a time', () => {
    renderBand();

    expect(screen.getByTestId('game-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('material-flow')).not.toBeInTheDocument();
    expect(layerTab('eval')).toHaveAttribute('aria-selected', 'true');
    expect(layerTab('material')).toHaveAttribute('aria-selected', 'false');
  });

  it('marks the eval tab as needing an analysis until one exists', () => {
    renderBand({ hasAnalysis: false });

    expect(screen.getByTestId('eval-layer-needs-analysis')).toBeInTheDocument();
    // The eval chart itself is a note, not a chart.
    expect(screen.queryByTestId('game-flow')).not.toBeInTheDocument();
    expect(screen.getByTestId('timeline-layer-eval')).toHaveTextContent('No analysis yet');
  });

  it('drops the eval marker once an analysis exists', () => {
    renderBand({ hasAnalysis: true });

    expect(screen.queryByTestId('eval-layer-needs-analysis')).not.toBeInTheDocument();
  });

  it('switches layers from the tab row, persisting the choice', () => {
    renderBand();

    // Fixed order: eval, material, activity, clocks.
    const order = screen.getAllByTestId('timeline-layer-tab').map((tab) => tab.dataset.layer);
    expect(order).toEqual(['eval', 'material', 'activity', 'clocks']);

    fireEvent.click(layerTab('material'));
    expect(screen.getByTestId('material-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('game-flow')).not.toBeInTheDocument();
    expect(layerTab('material')).toHaveAttribute('aria-selected', 'true');
    expect(localStorage.getItem('blunderfest.timelineActiveLayer')).toBe('material');
  });

  it('honors a stored layer choice from a previous session', () => {
    localStorage.setItem('blunderfest.timelineActiveLayer', 'activity');

    renderBand();

    expect(screen.getByTestId('activity-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('game-flow')).not.toBeInTheDocument();
  });

  it('shows the picked layer’s own empty note when it holds no data', () => {
    // No clock data in this tree: the clocks layer can’t chart.
    renderBand();

    fireEvent.click(layerTab('clocks'));
    expect(screen.getByTestId('timeline-layer-clocks')).toHaveTextContent('No clock data');
  });

  it('explains the clocks bar colors with a side legend on its tab', () => {
    renderBand();

    fireEvent.click(layerTab('clocks'));
    expect(screen.getByText('White')).toBeInTheDocument();
    expect(screen.getByText('Black')).toBeInTheDocument();
  });

  it('aligns the shared span, not the chart’s own last ply', () => {
    // The chart's own data ends at ply 2; the shared span is 4. The current
    // ply (2) must sit at the halfway line — without the span the chart
    // would put it at its own right edge.
    renderBand({ currentPly: 2, spanPly: 4 });

    expect(screen.getByTestId('game-flow-marker')).toHaveAttribute('x1', '50');
  });

  it('holds the analyze action in the header', () => {
    renderBand({ hasAnalysis: false, analyzeAction });

    const headerButton = screen.getByRole('button', { name: 'Analyze game' });
    fireEvent.click(headerButton);
    expect(analyzeAction.onClick).toHaveBeenCalledTimes(1);
  });

  it('hides the header action once an analysis exists', () => {
    renderBand({ hasAnalysis: true });

    expect(screen.queryByRole('button', { name: 'Analyze game' })).not.toBeInTheDocument();
  });

  it('renders a single fixed-height strip (no expand/collapse)', () => {
    renderBand();

    expect(document.querySelector('.h-24')).not.toBeNull();
    expect(screen.queryByTestId('timeline-expand')).not.toBeInTheDocument();
  });
});
