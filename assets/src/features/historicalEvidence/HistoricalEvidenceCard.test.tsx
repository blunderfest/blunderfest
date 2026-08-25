import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HistoricalEvidenceCard from '@/features/historicalEvidence/HistoricalEvidenceCard';
import type { EvidenceCandidate } from '@/features/historicalEvidence/types';

const candidate: EvidenceCandidate = {
  id: 'pawn_skeleton-5-17',
  strategy: 'pawn_skeleton',
  fen: 'r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 1',
  gid: 5,
  ply: 17,
  game: {
    gid: 5,
    white: 'PlayerA',
    black: 'PlayerB',
    result: '1-0',
    date: '2017.05.02',
    eco: 'E97',
    opening: "King's Indian",
    white_elo: 2300,
    black_elo: 2250,
    event: 'Fixture',
    time_control: '300+0',
    site: 'fix05',
  },
  position: {
    dims: {
      pawn_structure: 'same',
      material: 'same',
      piece_placement: { matches: 14, mismatches: 0, ref_pieces: 14 },
      king_position: 'same',
      side_to_move: 'differs',
      castling: 'same',
    },
    differences: [
      { type: 'tempo_twin', detail: 'identical placement; black to move (tempo twin)' },
    ],
  },
  route: {
    shared_plies: 6,
    diverged_ply: 7,
    ref_move: 'e4',
    cand_move: 'e3',
    ply_gap: 1,
    extra_white: ['e3'],
    extra_black: [],
    missing_white: [],
    missing_black: [],
  },
  continuation: {
    moves: ['Ne8', 'Bg5', 'h6', 'Be3', 'f5', 'Qc1'],
    differences: [],
  },
  families: {
    membership: {
      status: 'none',
      member_of: null,
      sim: 0.2,
      family_occurrences: 3,
      family_games: 3,
    },
    skeleton: {
      white: { status: 'none', family_id: 1, sim: 0.0, family_occurrences: 3, family_games: 3 },
      black: { status: 'member', family_id: 1, sim: 0.5, family_occurrences: 3, family_games: 3 },
    },
  },
  historical: { occurrences: 1, games: 1, same_game_only: false },
  flags: ['tempo_twin'],
};

describe('HistoricalEvidenceCard', () => {
  const plans = new Map([[1, { white: ['N→e1', 'N→d3', 'B→d2'], black: ['N→e8', 'P→f5'] }]]);

  it('renders position facts, route divergence and the per-side plans', () => {
    render(<HistoricalEvidenceCard candidate={candidate} plans={plans} />);

    expect(screen.getByText('PlayerA — PlayerB')).toBeInTheDocument();
    expect(screen.getByText('14/14 match')).toBeInTheDocument();
    expect(screen.getByText('6 plies')).toBeInTheDocument();
    expect(screen.getByText('ply 7: e4 → e3')).toBeInTheDocument();

    // Black joined plan 1: the plan's own actions are shown, with the
    // match quality; white matched nothing.
    expect(screen.getByText('N→e8 · P→f5 (50% match)')).toBeInTheDocument();
    expect(screen.getByText('none')).toBeInTheDocument();
    expect(screen.getByText('tempo twin')).toBeInTheDocument();
  });

  it('falls back to the plan id when no plan content is available', () => {
    render(<HistoricalEvidenceCard candidate={candidate} />);

    expect(screen.getByText('plan 1 (50% match)')).toBeInTheDocument();
  });

  it('offers to open the full game', () => {
    const onOpenGame = vi.fn();
    render(<HistoricalEvidenceCard candidate={candidate} onOpenGame={onOpenGame} />);

    fireEvent.click(screen.getByTestId('historical-evidence-open'));
    expect(onOpenGame).toHaveBeenCalled();
  });

  it('shows the opening state while the game loads', () => {
    render(<HistoricalEvidenceCard candidate={candidate} onOpenGame={vi.fn()} opening />);

    expect(screen.getByTestId('historical-evidence-open')).toBeDisabled();
    expect(screen.getByText('Opening…')).toBeInTheDocument();
  });

  it('marks same-game-only candidates', () => {
    render(
      <HistoricalEvidenceCard
        candidate={{
          ...candidate,
          historical: { occurrences: 2, games: 1, same_game_only: true },
          flags: ['same_game_only'],
        }}
      />,
    );

    expect(screen.getByText('repeated in one game')).toBeInTheDocument();
    expect(screen.getByText('same game only')).toBeInTheDocument();
  });
});
