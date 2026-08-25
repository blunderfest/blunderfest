import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HistoricalEvidencePanel from '@/features/historicalEvidence/HistoricalEvidencePanel';
import type {
  EvidenceCandidate,
  HistoricalEvidenceResult,
} from '@/features/historicalEvidence/types';

vi.mock('@/lib/api', () => ({
  analyzeHistoricalEvidence: vi.fn(),
  fetchHistoricalGame: vi.fn(),
  createRoom: vi.fn(),
  withDeviceRetry: vi.fn(),
}));

import {
  analyzeHistoricalEvidence,
  createRoom,
  fetchHistoricalGame,
  withDeviceRetry,
} from '@/lib/api';

const mockAnalyze = vi.mocked(analyzeHistoricalEvidence);
const mockFetchGame = vi.mocked(fetchHistoricalGame);
const mockCreateRoom = vi.mocked(createRoom);

vi.mocked(withDeviceRetry).mockImplementation(async (fn) => fn({ id: 'dev', secret: 'secret' }));

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

function renderPanel(props?: {
  fen?: string | null;
  route?: string[] | null;
  refPly?: number | null;
}) {
  const fen = props?.fen === undefined ? START : props.fen;
  return render(
    <HistoricalEvidencePanel
      fen={fen}
      route={props?.route === undefined ? null : props.route}
      refPly={props?.refPly === undefined ? null : props.refPly}
    />,
  );
}

describe('HistoricalEvidencePanel', () => {
  beforeEach(() => {
    mockAnalyze.mockReset();
    mockAnalyze.mockResolvedValue(result);
    mockFetchGame.mockReset();
    mockCreateRoom.mockReset();
    mockCreateRoom.mockResolvedValue({ code: 'abcde' });
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

  it('opens the full game in a fresh room', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    mockFetchGame.mockResolvedValue({ tree: treeForGame });

    renderPanel();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    fireEvent.click(await screen.findByTestId('historical-evidence-open'));

    await waitFor(() => {
      expect(mockFetchGame).toHaveBeenCalledWith(1);
      expect(mockCreateRoom).toHaveBeenCalledWith(
        expect.stringMatching(/^[abcdefghjkmnpqrstuvwxyz23456789]{5}$/),
        treeForGame,
        { id: 'dev', secret: 'secret' },
      );
    });
    expect(window.location.hash).toMatch(/^#\/r\/[abcdefghjkmnpqrstuvwxyz23456789]{5}$/);
  });

  it('surfaces game-open failures and allows retrying', async () => {
    mockAnalyze.mockResolvedValue({ ...result, candidates: [openCandidate] });
    mockFetchGame.mockRejectedValue(new Error('boom'));

    renderPanel();

    fireEvent.click(screen.getByTestId('historical-evidence-run'));
    fireEvent.click(await screen.findByTestId('historical-evidence-open'));

    expect(await screen.findByText("Couldn't open that game — try again.")).toBeInTheDocument();
    expect(mockCreateRoom).not.toHaveBeenCalled();
  });
});
