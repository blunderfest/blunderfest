import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HistoricalEvidencePanel, {
  resetHistoricalEvidenceCache,
} from '@/features/historicalEvidence/HistoricalEvidencePanel';
import type {
  EvidenceCandidate,
  HistoricalEvidenceResult,
} from '@/features/historicalEvidence/types';

vi.mock('@/lib/api', () => ({
  analyzeHistoricalEvidence: vi.fn(),
  fetchHistoricalGame: vi.fn(),
}));

import { analyzeHistoricalEvidence, fetchHistoricalGame } from '@/lib/api';

const mockAnalyze = vi.mocked(analyzeHistoricalEvidence);
const mockFetchGame = vi.mocked(fetchHistoricalGame);

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const result: HistoricalEvidenceResult = {
  reference: { fen: START, occurrences: 11, games: 8, families: [] },
  candidates: [],
  timings: { candidates_ms: 1, menu_ms: 1, evidence_ms: 1, total_ms: 3 },
};

const openCandidate: EvidenceCandidate = {
  id: 'exact-1-16',
  strategy: 'exact',
  stm: 'w',
  fen: START,
  gid: 1,
  ply: 16,
  game: {
    gid: 1,
    white: 'PlayerA',
    black: 'PlayerB',
    result: '1-0',
    date: '2017.05.01',
    eco: 'E97',
    opening: "King's Indian",
    white_elo: 2400,
    black_elo: 2350,
    event: 'Fixture',
    time_control: '300+0',
    site: 'fix01',
  },
  position: {
    dims: {
      pawn_structure: 'same',
      material: 'same',
      piece_placement: { matches: 14, mismatches: 0, ref_pieces: 14 },
      king_position: 'same',
      side_to_move: 'same',
      castling: 'same',
    },
    differences: [],
  },
  route: {
    shared_plies: 16,
    ref_ply: 16,
    diverged_ply: null,
    ref_move: null,
    cand_move: null,
    ply_gap: 0,
    extra_white: [],
    extra_black: [],
    missing_white: [],
    missing_black: [],
  },
  continuation: { moves: [], differences: [] },
  families: {
    membership: {
      status: 'member',
      member_of: 1,
      sim: 1,
      family_occurrences: 2,
      family_games: 2,
    },
    skeleton: {
      white: { status: 'member', family_id: 1, sim: 1, family_occurrences: 2, family_games: 2 },
      black: { status: 'member', family_id: 1, sim: 1, family_occurrences: 2, family_games: 2 },
    },
  },
  historical: { occurrences: 1, games: 1, same_game_only: false },
  flags: [],
};

const treeForGame = {
  headers: {},
  result: '1-0',
  setup: null,
  mainline_ply_count: 0,
  node_count: 1,
  root: {
    id: 0,
    ply: 0,
    san: null,
    from: null,
    to: null,
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    fen: START,
    children: [],
  },
};

function renderPanel(
  props?: {
    fen?: string | null;
    route?: string[] | null;
    refPly?: number | null;
    gameHeaders?: Record<string, string>;
  },
  callbacks?: {
    onAddGame?: (tree: unknown, ply: number, gid: number) => void;
    onAddVariation?: (fen: string, sans: string[], exact: boolean) => void;
    addedGids?: ReadonlySet<number>;
  },
) {
  const fen = props?.fen === undefined ? START : props.fen;
  return render(
    <HistoricalEvidencePanel
      fen={fen}
      route={props?.route === undefined ? null : props.route}
      refPly={props?.refPly === undefined ? null : props.refPly}
      gameHeaders={props?.gameHeaders ?? {}}
      onAddGame={callbacks?.onAddGame}
      onAddVariation={callbacks?.onAddVariation}
      addedGids={callbacks?.addedGids}
    />,
  );
}

describe('HistoricalEvidencePanel', () => {
  beforeEach(() => {
    resetHistoricalEvidenceCache();
    mockAnalyze.mockReset();
    mockAnalyze.mockResolvedValue(result);
    mockFetchGame.mockReset();
  });

  it('runs the analysis on demand and shows the example count', async () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));

    await waitFor(() => {
      expect(mockAnalyze).toHaveBeenCalledWith(START, { route: undefined, refPly: undefined });
    });
    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();
  });

  it('passes the route and refPly of the user game', async () => {
    renderPanel({ route: ['e4', 'e5'], refPly: 2 });

    fireEvent.click(screen.getByTestId('historical-evidence-run'));

    await waitFor(() => {
      expect(mockAnalyze).toHaveBeenCalledWith(START, { route: ['e4', 'e5'], refPly: 2 });
    });
  });

  it('hides the analyzed game itself from the results', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    // The panel receives the analyzed game's PGN headers; the candidate
    // meta (PlayerA – PlayerB, 1-0) is that game — the corpus contains it.
    renderPanel({ gameHeaders: { White: 'PlayerA', Black: 'PlayerB', Result: '1-0' } });

    fireEvent.click(screen.getByTestId('historical-evidence-run'));

    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();
    expect(screen.queryByTestId('historical-evidence-card')).not.toBeInTheDocument();
    expect(
      screen.getByText('No historical examples found for this position yet.'),
    ).toBeInTheDocument();
  });

  it('keeps candidates whose headers differ from the analyzed game', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });

    renderPanel({ gameHeaders: { White: 'Someone', Black: 'Else' } });

    fireEvent.click(screen.getByTestId('historical-evidence-run'));

    expect(await screen.findByTestId('historical-evidence-card')).toBeInTheDocument();
  });

  it('disables Find examples once the results are shown, and re-enables when stale', async () => {
    const { rerender } = renderPanel();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();
    expect(screen.getByTestId('historical-evidence-run')).toBeDisabled();

    // The cursor moved: the results are stale and the button re-enables.
    rerender(
      <HistoricalEvidencePanel
        fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
        route={null}
        refPly={null}
      />,
    );
    expect(screen.getByTestId('historical-evidence-run')).toBeEnabled();
  });

  it('explains itself while the corpus query runs', async () => {
    let resolveAnalyze: (value: HistoricalEvidenceResult) => void = () => {};
    mockAnalyze.mockImplementation(
      () =>
        new Promise<HistoricalEvidenceResult>((resolve) => {
          resolveAnalyze = resolve;
        }),
    );

    renderPanel();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    expect(await screen.findByText('Searching the game corpus…')).toBeInTheDocument();

    await act(async () => resolveAnalyze(result));
    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();
  });

  it('shows the empty state when there is no game', () => {
    renderPanel({ fen: null });

    expect(screen.queryByTestId('historical-evidence-run')).toBeDisabled();
  });

  it('is disabled in read-only rooms (the demo rule)', async () => {
    render(<HistoricalEvidencePanel fen={START} route={null} refPly={null} canAnalyze={false} />);

    expect(screen.getByTestId('historical-evidence-run')).toBeDisabled();
    expect(
      screen.getByText(
        'This room is read-only — historical analysis is available in rooms you can edit.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it('surfaces errors and keeps them until retry', async () => {
    mockAnalyze.mockRejectedValue(new Error('boom'));

    renderPanel();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));

    expect(await screen.findByText('The analysis failed — please try again.')).toBeInTheDocument();

    mockAnalyze.mockResolvedValue(result);
    fireEvent.click(screen.getByTestId('historical-evidence-run'));

    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();
  });

  it('does not re-run when the cursor moves — results are marked stale instead', async () => {
    const { rerender } = renderPanel();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();

    rerender(
      <HistoricalEvidencePanel
        fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
        route={null}
        refPly={null}
      />,
    );

    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('The position changed — run the analysis again to see examples for it.'),
    ).toBeInTheDocument();
  });

  it('adds the historical game to the room at the candidate ply', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    mockFetchGame.mockResolvedValue({ tree: treeForGame });
    const onAddGame = vi.fn<(tree: unknown, ply: number, gid: number) => void>();

    renderPanel(undefined, { onAddGame });

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    fireEvent.click(await screen.findByTestId('historical-evidence-add-game'));

    await waitFor(() => {
      expect(mockFetchGame).toHaveBeenCalledWith(1);
      expect(onAddGame).toHaveBeenCalledWith(treeForGame, 16, 1);
    });
  });

  it('restores a finished analysis when the panel remounts (a game switch)', async () => {
    const first = renderPanel();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();
    expect(mockAnalyze).toHaveBeenCalledTimes(1);

    // The panel unmounts on every game switch; a remount at the same
    // position shows the remembered result without a re-run.
    first.unmount();
    renderPanel();

    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });

  it('offers the continuation as a variation for exact candidates', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    const onAddVariation = vi.fn<(fen: string, sans: string[], exact: boolean) => void>();

    renderPanel(undefined, { onAddVariation });

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    fireEvent.click(await screen.findByTestId('historical-evidence-add-variation'));

    expect(onAddVariation).toHaveBeenCalledWith(START, [], true);
  });

  it('offers the variation for structural candidates too (setup + line path)', async () => {
    const structural = { ...openCandidate, strategy: 'pawn_skeleton' as const };
    mockAnalyze.mockResolvedValue({ ...result, candidates: [structural] });
    const onAddVariation = vi.fn<(fen: string, sans: string[], exact: boolean) => void>();
    const onAddGame = vi.fn<(tree: unknown, ply: number, gid: number) => void>();

    renderPanel(undefined, { onAddGame, onAddVariation });

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    fireEvent.click(await screen.findByTestId('historical-evidence-add-variation'));

    expect(onAddVariation).toHaveBeenCalledWith(START, [], false);
  });

  it('surfaces add-to-room failures', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    mockFetchGame.mockRejectedValue(new Error('boom'));
    const onAddGame = vi.fn<(tree: unknown, ply: number, gid: number) => void>();

    renderPanel(undefined, { onAddGame });

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    fireEvent.click(await screen.findByTestId('historical-evidence-add-game'));

    expect(await screen.findByText("Couldn't add that game — try again.")).toBeInTheDocument();
    expect(onAddGame).not.toHaveBeenCalled();
  });

  it('shows Added ✓ from the start for games the host reports as in the room', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    const onAddGame = vi.fn<(tree: unknown, ply: number, gid: number) => void>();

    renderPanel(undefined, { onAddGame, addedGids: new Set([1]) });

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    const button = await screen.findByTestId('historical-evidence-add-game');
    expect(button).toHaveTextContent('Added ✓');
    expect(button).toBeDisabled();
    expect(onAddGame).not.toHaveBeenCalled();
  });

  it('flips to Added ✓ when the host records the add (duplicates included)', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    mockFetchGame.mockResolvedValue({ tree: treeForGame });
    const onAddGame = vi.fn<(tree: unknown, ply: number, gid: number) => void>();

    const { rerender } = renderPanel(undefined, { onAddGame });

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    fireEvent.click(await screen.findByTestId('historical-evidence-add-game'));
    await waitFor(() => expect(onAddGame).toHaveBeenCalledTimes(1));
    // The host records the gid whether the game was added or skipped as a
    // duplicate — either way it is in the room now.
    rerender(
      <HistoricalEvidencePanel
        fen={START}
        route={null}
        refPly={null}
        onAddGame={onAddGame}
        addedGids={new Set([1])}
      />,
    );

    const button = screen.getByTestId('historical-evidence-add-game');
    expect(button).toHaveTextContent('Added ✓');
    expect(button).toBeDisabled();
  });

  it('disables the variation button once the tree already contains the line', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    const onAddVariation = vi.fn<(fen: string, sans: string[], exact: boolean) => void>();

    render(
      <HistoricalEvidencePanel
        fen={START}
        route={null}
        refPly={null}
        onAddVariation={onAddVariation}
        variationState={() => ({ addable: true, exists: true })}
      />,
    );

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    const button = await screen.findByTestId('historical-evidence-add-variation');
    expect(button).toHaveTextContent('Added ✓');
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onAddVariation).not.toHaveBeenCalled();
  });

  it('disables the variation button when the line is not playable', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    const onAddVariation = vi.fn<(fen: string, sans: string[], exact: boolean) => void>();

    render(
      <HistoricalEvidencePanel
        fen={START}
        route={null}
        refPly={null}
        onAddVariation={onAddVariation}
        variationState={() => ({ addable: false, exists: false })}
      />,
    );

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    const button = await screen.findByTestId('historical-evidence-add-variation');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      'title',
      "This continuation can't be played from the current position.",
    );
  });

  it('shows Adding… on a variation click until the echo lands in the tree', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    const onAddVariation = vi.fn<(fen: string, sans: string[], exact: boolean) => void>();

    const props = (exists: boolean) => (
      <HistoricalEvidencePanel
        fen={START}
        route={null}
        refPly={null}
        onAddVariation={onAddVariation}
        variationState={() => ({ addable: true, exists })}
      />
    );
    const { rerender } = render(props(false));

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    fireEvent.click(await screen.findByTestId('historical-evidence-add-variation'));
    expect(screen.getByTestId('historical-evidence-add-variation')).toHaveTextContent('Adding…');
    expect(onAddVariation).toHaveBeenCalledTimes(1);

    // The echo lands: the orchestrator's state flips, and the label follows.
    rerender(props(true));
    expect(await screen.findByText('Added ✓')).toBeInTheDocument();
    expect(screen.getByTestId('historical-evidence-add-variation')).toBeDisabled();
  });

  it('gives up the Adding… state when the echo never lands', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    const onAddVariation = vi.fn<(fen: string, sans: string[], exact: boolean) => void>();

    vi.useFakeTimers();
    try {
      render(
        <HistoricalEvidencePanel
          fen={START}
          route={null}
          refPly={null}
          onAddVariation={onAddVariation}
          variationState={() => ({ addable: true, exists: false })}
        />,
      );

      fireEvent.click(screen.getByTestId('historical-evidence-run'));
      await act(async () => {});
      fireEvent.click(screen.getByTestId('historical-evidence-add-variation'));
      expect(screen.getByTestId('historical-evidence-add-variation')).toHaveTextContent('Adding…');

      act(() => vi.advanceTimersByTime(5000));
      expect(screen.getByTestId('historical-evidence-add-variation')).toHaveTextContent(
        'Add as variation',
      );
      expect(screen.getByTestId('historical-evidence-add-variation')).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
