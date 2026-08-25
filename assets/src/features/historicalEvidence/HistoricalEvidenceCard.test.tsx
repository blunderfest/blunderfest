import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HistoricalEvidenceCard from '@/features/historicalEvidence/HistoricalEvidenceCard';
import type { EvidenceCandidate } from '@/features/historicalEvidence/types';

const candidate: EvidenceCandidate = {
  id: 'pawn_skeleton-5-17',
  strategy: 'pawn_skeleton',
  stm: 'b',
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
    ref_ply: 16,
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

const plans = new Map([[1, { white: ['N→e1', 'N→d3', 'B→d2'], black: ['N→e8', 'P→f5'] }]]);

describe('HistoricalEvidenceCard', () => {
  it('heads the card with the positional relationship', () => {
    render(<HistoricalEvidenceCard candidate={candidate} />);

    expect(screen.getByText('Same position · other side to move')).toBeInTheDocument();
    expect(screen.getByText('PlayerA — PlayerB')).toBeInTheDocument();
    expect(screen.getByText('E97 · 1-0')).toBeInTheDocument();
  });

  it('keeps the route divergence concrete', () => {
    render(<HistoricalEvidenceCard candidate={candidate} />);

    expect(screen.getByText('Same route for')).toBeInTheDocument();
    expect(screen.getByText('6 plies')).toBeInTheDocument();
    expect(screen.getByText('Ply 7: White played e4 · this game played e3')).toBeInTheDocument();
    expect(screen.getByText('1 ply later')).toBeInTheDocument();
  });

  it('shows the continuation per side, split from the candidate side to move', () => {
    render(<HistoricalEvidenceCard candidate={candidate} />);

    // Black to move: black plays 1st, 3rd, 5th...
    expect(screen.getByText('Ne8 · h6 · f5')).toBeInTheDocument();
    expect(screen.getByText('Bg5 · Be3 · Qc1')).toBeInTheDocument();
  });

  it('shows continuation verdicts only when confidence is high', () => {
    // Black joined at 0.5 — below the 0.8 confidence bar: no verdict.
    render(<HistoricalEvidenceCard candidate={candidate} />);
    expect(screen.queryByText(/followed the/)).not.toBeInTheDocument();
    // White matched nothing, so its verdict is the "different" fact.
    expect(screen.getByText('followed a different continuation')).toBeInTheDocument();
  });

  it('names the most common continuation when the match is strong', () => {
    const confident = {
      ...candidate,
      families: {
        ...candidate.families,
        skeleton: {
          ...candidate.families.skeleton,
          black: {
            status: 'member' as const,
            family_id: 1,
            sim: 1.0,
            family_occurrences: 3,
            family_games: 3,
          },
        },
      },
    };
    render(<HistoricalEvidenceCard candidate={confident} />);
    expect(screen.getByText('followed the most common continuation')).toBeInTheDocument();
  });

  it('splits counts by candidate type and repetition', () => {
    const repeated = {
      ...candidate,
      historical: { occurrences: 2, games: 1, same_game_only: true },
    };
    render(<HistoricalEvidenceCard candidate={repeated} />);
    expect(screen.getByText('1 game · 2 occurrences from the same game')).toBeInTheDocument();

    const common = {
      ...candidate,
      historical: { occurrences: 499, games: 499, same_game_only: false },
    };
    render(<HistoricalEvidenceCard candidate={common} />);
    expect(screen.getByText('499 games')).toBeInTheDocument();
  });

  it('omits the route section for a bare-FEN analysis', () => {
    const bare = { ...candidate, route: { ...candidate.route, ref_ply: null } };
    render(<HistoricalEvidenceCard candidate={bare} />);

    expect(screen.queryByText('Same route for')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ply 7:/)).not.toBeInTheDocument();
  });

  it('tucks the raw comparison numbers behind the details disclosure', () => {
    const { container } = render(<HistoricalEvidenceCard candidate={candidate} plans={plans} />);

    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);

    fireEvent.click(screen.getByText(/Comparison details/));

    expect(details?.open).toBe(true);
    expect(screen.getByText('identical placement; black to move (tempo twin)')).toBeInTheDocument();
    expect(
      screen.getByText('Black matches plan 1 · similarity 0.50 · N→e8 · P→f5'),
    ).toBeInTheDocument();
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
});
