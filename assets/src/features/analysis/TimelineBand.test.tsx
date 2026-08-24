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

const analyzePlaceholder = <button type="button">Analyze game</button>;

function renderBand(overrides: Partial<Parameters<typeof TimelineBand>[0]> = {}) {
  return render(
    <TimelineBand
      tree={tree}
      evals={evals}
      currentPly={2}
      spanPly={3}
      hasAnalysis
      analyzePlaceholder={analyzePlaceholder}
      onSelectPly={vi.fn()}
      {...overrides}
    />,
  );
}

function layerToggle(id: string): HTMLElement {
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
  });

  it('renders the eval and material layers by default', () => {
    renderBand();

    expect(screen.getByTestId('game-flow')).toBeInTheDocument();
    expect(screen.getByTestId('material-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-flow')).not.toBeInTheDocument();
  });

  it('aligns every layer on the shared span, not each chart\u2019s own last ply', () => {
    // Both charts' own data ends at ply 2; the shared span is 4. The
    // current ply (2) must sit at the halfway line of both — without the
    // span each chart would put it at its own right edge.
    renderBand({ currentPly: 2, spanPly: 4 });

    expect(screen.getByTestId('game-flow-marker')).toHaveAttribute('x1', '50');
    expect(screen.getByTestId('material-flow-marker')).toHaveAttribute('x1', '50');
  });

  it('holds the eval layer with the analyze placeholder before an analysis', () => {
    renderBand({ hasAnalysis: false });

    expect(screen.queryByTestId('game-flow')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze game' })).toBeInTheDocument();
    // The pure-FEN layer still charts.
    expect(screen.getByTestId('material-flow')).toBeInTheDocument();
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
