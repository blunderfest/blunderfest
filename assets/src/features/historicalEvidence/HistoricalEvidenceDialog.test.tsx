import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetHistoricalEvidenceCache } from '@/features/historicalEvidence/evidenceCache';
import HistoricalEvidenceDialog from '@/features/historicalEvidence/HistoricalEvidenceDialog';
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
  reference: {
    fen: START,
    occurrences: 11,
    games: 8,
    families: [],
    next_moves: [],
  },
  candidates: [],
  timings: { candidates_ms: 1, menu_ms: 1, evidence_ms: 1, total_ms: 3 },
};

function candidate(overrides?: Partial<EvidenceCandidate>): EvidenceCandidate {
  return {
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
    ...overrides,
  };
}

const secondCandidate = candidate({
  id: 'exact-2-1',
  gid: 2,
  ply: 1,
  game: {
    gid: 2,
    white: 'Eve',
    black: 'Frank',
    result: '0-1',
    date: '2019.01.01',
    eco: 'A00',
    opening: 'Uncommon',
    white_elo: null,
    black_elo: null,
    event: 'Fixture',
    time_control: '300+0',
    site: 'fix02',
  },
});

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

function renderDialog(
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
    onClose?: () => void;
  },
) {
  const fen = props?.fen === undefined ? START : props.fen;
  return render(
    <HistoricalEvidenceDialog
      fen={fen}
      route={props?.route === undefined ? null : props.route}
      refPly={props?.refPly === undefined ? null : props.refPly}
      gameHeaders={props?.gameHeaders ?? {}}
      onClose={callbacks?.onClose ?? vi.fn()}
      onAddGame={callbacks?.onAddGame}
      onAddVariation={callbacks?.onAddVariation}
      addedGids={callbacks?.addedGids}
    />,
  );
}

describe('HistoricalEvidenceDialog', () => {
  beforeEach(() => {
    resetHistoricalEvidenceCache();
    mockAnalyze.mockReset();
    mockAnalyze.mockResolvedValue(result);
    mockFetchGame.mockReset();
  });

  it('runs the query privately on open and shows the example count', async () => {
    renderDialog();

    await waitFor(() => {
      expect(mockAnalyze).toHaveBeenCalledWith(START, { route: undefined, refPly: undefined });
    });
    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();
  });

  it('passes the route and refPly of the user game', async () => {
    renderDialog({ route: ['e4', 'e5'], refPly: 2 });

    await waitFor(() => {
      expect(mockAnalyze).toHaveBeenCalledWith(START, { route: ['e4', 'e5'], refPly: 2 });
    });
  });

  it('renders the decision menu atop the results list', async () => {
    mockAnalyze.mockResolvedValue({
      ...result,
      reference: {
        ...result.reference,
        fen: 'r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 0 7',
        next_moves: [
          { move: 'O-O', games: 43 },
          { move: 'd6', games: 28 },
        ],
      },
      candidates: [candidate(), secondCandidate],
    });

    renderDialog();

    // The menu sits above the results list in the left pane — heading names Black.
    expect(await screen.findByTestId('evidence-decision-menu')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /what did Black play next/i })).toBeInTheDocument();

    const menu = screen.getByTestId('evidence-decision-menu');
    const list = screen.getByTestId('historical-evidence-list');
    expect(menu.compareDocumentPosition(list)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    // Both games are listed.
    expect(screen.getAllByTestId('historical-evidence-row')).toHaveLength(2);
  });

  it('no menu when the response carries no next moves', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [candidate()] });

    renderDialog();

    expect(await screen.findByTestId('historical-evidence-card')).toBeInTheDocument();
    expect(screen.queryByTestId('evidence-decision-menu')).toBeNull();
  });

  it('explains itself while the corpus query runs', async () => {
    let resolveAnalyze: (value: HistoricalEvidenceResult) => void = () => {};
    mockAnalyze.mockImplementation(
      () =>
        new Promise<HistoricalEvidenceResult>((resolve) => {
          resolveAnalyze = resolve;
        }),
    );

    renderDialog();

    expect(await screen.findByText('Searching the game corpus…')).toBeInTheDocument();

    await act(async () => resolveAnalyze(result));
    expect(await screen.findByText('0 examples · 3 ms')).toBeInTheDocument();
  });

  it('surfaces errors', async () => {
    mockAnalyze.mockRejectedValue(new Error('boom'));

    renderDialog();

    expect(await screen.findByText('The analysis failed — please try again.')).toBeInTheDocument();
  });

  it('hides the analyzed game itself from the candidates', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [candidate()] });
    renderDialog({ gameHeaders: { White: 'PlayerA', Black: 'PlayerB', Result: '1-0' } });

    expect(
      await screen.findByText('No historical examples found for this position yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('historical-evidence-card')).not.toBeInTheDocument();
  });

  it('keeps the finder at a fixed height while details expand and collapse', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [candidate()] });

    renderDialog();

    await screen.findByTestId('historical-evidence-row');
    // The two-pane row carries the height; expanding the card's Comparison
    // details scrolls the pane instead of resizing the dialog.
    const finder = screen.getByTestId('historical-evidence-finder');
    expect(finder).toHaveClass('h-[min(60dvh,34rem)]');

    fireEvent.click(screen.getByText(/Comparison details/));
    expect(finder).toHaveClass('h-[min(60dvh,34rem)]');
  });

  it('lists every candidate and previews the picked one in the detail pane', async () => {
    mockAnalyze.mockResolvedValue({
      ...result,
      candidates: [candidate(), secondCandidate],
    });

    renderDialog();

    // Both rows are listed at once; the first is selected/previewed.
    const rows = await screen.findAllByTestId('historical-evidence-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
    expect(rows[1]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getAllByText('PlayerA — PlayerB').length).toBeGreaterThan(0);

    // Picking the second row previews its game in the detail pane.
    fireEvent.click(rows[1]);
    expect(rows[1]).toHaveAttribute('aria-selected', 'true');
    expect(rows[0]).toHaveAttribute('aria-selected', 'false');
    // The detail card now shows the second candidate (its eco appears once in the card).
    expect(screen.getByTestId('historical-evidence-card')).toHaveTextContent('Eve — Frank');
  });

  it('moves the selection with the arrow keys and closes on Escape', async () => {
    mockAnalyze.mockResolvedValue({
      ...result,
      candidates: [candidate(), secondCandidate],
    });
    const onClose = vi.fn();

    renderDialog(undefined, { onClose });

    const rows = await screen.findAllByTestId('historical-evidence-row');
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(rows[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop click', async () => {
    const onClose = vi.fn();
    renderDialog(undefined, { onClose });

    await screen.findByText('0 examples · 3 ms');
    fireEvent.click(screen.getByTestId('historical-evidence-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('adds the historical game to the room at the candidate ply', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [candidate()] });
    mockFetchGame.mockResolvedValue({ tree: treeForGame });
    const onAddGame = vi.fn<(tree: unknown, ply: number, gid: number) => void>();

    renderDialog(undefined, { onAddGame });

    fireEvent.click(await screen.findByTestId('historical-evidence-add-game'));

    await waitFor(() => {
      expect(mockFetchGame).toHaveBeenCalledWith(1);
      expect(onAddGame).toHaveBeenCalledWith(treeForGame, 16, 1);
    });
  });

  it('does not change the selection after a pick', async () => {
    mockAnalyze.mockResolvedValue({
      ...result,
      candidates: [candidate(), secondCandidate],
    });
    mockFetchGame.mockResolvedValue({ tree: treeForGame });
    const onAddGame = vi.fn<(tree: unknown, ply: number, gid: number) => void>();

    renderDialog(undefined, { onAddGame });

    fireEvent.click(await screen.findByTestId('historical-evidence-add-game'));
    await waitFor(() => expect(onAddGame).toHaveBeenCalledTimes(1));

    // Still on the same row — the user navigates manually.
    const rows = screen.getAllByTestId('historical-evidence-row');
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('surfaces add-to-room failures', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [candidate()] });
    mockFetchGame.mockRejectedValue(new Error('boom'));
    const onAddGame = vi.fn<(tree: unknown, ply: number, gid: number) => void>();

    renderDialog(undefined, { onAddGame });

    fireEvent.click(await screen.findByTestId('historical-evidence-add-game'));

    expect(await screen.findByText("Couldn't add that game — try again.")).toBeInTheDocument();
    expect(onAddGame).not.toHaveBeenCalled();
  });

  it('shows "same game" for games the host reports as in the room', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [candidate()] });
    const onAddGame = vi.fn<(tree: unknown, ply: number, gid: number) => void>();

    renderDialog(undefined, { onAddGame, addedGids: new Set([1]) });

    const button = await screen.findByTestId('historical-evidence-add-game');
    expect(button).toHaveTextContent('Same game — already added');
    expect(button).toBeDisabled();
    expect(onAddGame).not.toHaveBeenCalled();
  });

  it('offers the continuation as a variation for exact candidates', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [candidate()] });
    const onAddVariation = vi.fn<(fen: string, sans: string[], exact: boolean) => void>();

    renderDialog(undefined, { onAddVariation });

    fireEvent.click(await screen.findByTestId('historical-evidence-add-variation'));

    expect(onAddVariation).toHaveBeenCalledWith(START, [], true);
  });

  it('offers the variation for structural candidates too (setup + line path)', async () => {
    const structural = candidate({ strategy: 'pawn_skeleton' });
    mockAnalyze.mockResolvedValue({ ...result, candidates: [structural] });
    const onAddVariation = vi.fn<(fen: string, sans: string[], exact: boolean) => void>();

    renderDialog(undefined, { onAddVariation });

    fireEvent.click(await screen.findByTestId('historical-evidence-add-variation'));

    expect(onAddVariation).toHaveBeenCalledWith(START, [], false);
  });

  it('shows Adding… on a variation click until the echo lands in the tree', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [candidate()] });
    const onAddVariation = vi.fn<(fen: string, sans: string[], exact: boolean) => void>();

    const props = (exists: boolean) => (
      <HistoricalEvidenceDialog
        fen={START}
        onClose={vi.fn()}
        onAddVariation={onAddVariation}
        variationState={() => ({ addable: true, exists })}
      />
    );
    const { rerender } = render(props(false));

    fireEvent.click(await screen.findByTestId('historical-evidence-add-variation'));
    expect(screen.getByTestId('historical-evidence-add-variation')).toHaveTextContent('Adding…');
    expect(onAddVariation).toHaveBeenCalledTimes(1);

    // The echo lands: the orchestrator's state flips, and the label follows.
    rerender(props(true));
    expect(await screen.findByText('Added ✓')).toBeInTheDocument();
    expect(screen.getByTestId('historical-evidence-add-variation')).toBeDisabled();
  });

  it('disables the variation button when the line is not playable', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [candidate()] });
    const onAddVariation = vi.fn<(fen: string, sans: string[], exact: boolean) => void>();

    render(
      <HistoricalEvidenceDialog
        fen={START}
        onClose={vi.fn()}
        onAddVariation={onAddVariation}
        variationState={() => ({ addable: false, exists: false })}
      />,
    );

    const button = await screen.findByTestId('historical-evidence-add-variation');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      'title',
      "This continuation can't be played from the current position.",
    );
  });

  it('gives up the Adding… state when the echo never lands', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [candidate()] });
    const onAddVariation = vi.fn<(fen: string, sans: string[], exact: boolean) => void>();

    vi.useFakeTimers();
    try {
      render(
        <HistoricalEvidenceDialog
          fen={START}
          onClose={vi.fn()}
          onAddVariation={onAddVariation}
          variationState={() => ({ addable: true, exists: false })}
        />,
      );

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

  it('restores a finished analysis when the dialog reopens for the same position', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [candidate()] });
    const first = renderDialog();

    expect(await screen.findByText('1 examples · 3 ms')).toBeInTheDocument();
    expect(mockAnalyze).toHaveBeenCalledTimes(1);

    // Close and reopen at the same position: the remembered result appears
    // without a re-run.
    first.unmount();
    renderDialog();

    expect(await screen.findByText('1 examples · 3 ms')).toBeInTheDocument();
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });
});
