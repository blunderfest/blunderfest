import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import DecisionMenu from '@/features/historicalEvidence/DecisionMenu';
import type { NextMoveRow } from '@/features/historicalEvidence/types';

const F1 = 'r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 17';
const A2 = 'r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 0 7';

const f1Moves: NextMoveRow[] = [
  { move: 'Ne1', games: 14 },
  { move: 'b4', games: 9 },
  { move: 'a3', games: 2 },
  { move: 'Nd2', games: 1 },
  { move: 'Bd2', games: 1 },
  { move: 'Qc2', games: 1 },
];

const a2Moves: NextMoveRow[] = [
  { move: 'O-O', games: 43 },
  { move: 'd6', games: 28 },
];

const najdorfMoves: NextMoveRow[] = [
  { move: 'Bg5', games: 120 },
  { move: 'Be3', games: 81 },
  { move: 'Bc4', games: 59 },
  { move: 'Be2', games: 56 },
  { move: 'f3', games: 40 },
  { move: 'Bd3', games: 39 },
  { move: 'a4', games: 18 },
  { move: 'h3', games: 15 },
  { move: 'a3', games: 12 },
  { move: 'g3', games: 11 },
  { move: 'Nb3', games: 9 },
  { move: 'f4', games: 7 },
  { move: 'Nf3', games: 4 },
  { move: 'Bf4', games: 1 },
  { move: 'Nde2', games: 1 },
  { move: 'Qe2', games: 1 },
  { move: 'Rg1', games: 1 },
  { move: 'b3', games: 1 },
  { move: 'g4', games: 1 },
  { move: 'Bb5+', games: 1 },
  { move: 'h4', games: 1 },
];

describe('DecisionMenu', () => {
  it('renders the next-move distribution with independent-game counts', () => {
    render(<DecisionMenu fen={F1} nextMoves={f1Moves} />);

    expect(screen.getByTestId('evidence-decision-menu')).toBeInTheDocument();
    const rows = screen.getAllByTestId('evidence-menu-row');
    // Sorted by games desc, tie-broken by move name: Ne1, b4, a3, Bd2, Nd2, Qc2
    expect(rows[0].textContent).toContain('Ne1');
    expect(rows[0].textContent).toContain('14 games');
    expect(rows[1].textContent).toContain('b4');
    expect(rows[1].textContent).toContain('9 games');
    expect(rows.length).toBe(6);
    // the 1-game rows pluralize singularly
    expect(screen.getAllByText('1 game').length).toBe(3);
  });

  it('A2: exposes the two main next moves (family clustering chains; the menu does not)', () => {
    render(<DecisionMenu fen={A2} nextMoves={a2Moves} />);

    const rows = screen.getAllByTestId('evidence-menu-row');
    expect(rows.map((r) => r.textContent)).toEqual(['O-O43 games', 'd628 games']);
  });

  it('derives the side to move from the FEN (black)', () => {
    render(<DecisionMenu fen={A2} nextMoves={a2Moves} />);

    expect(screen.getByRole('heading', { name: /what did Black play next/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /white/i })).toBeNull();
  });

  it('derives the side to move from the FEN (white)', () => {
    render(<DecisionMenu fen={F1} nextMoves={f1Moves} />);

    expect(screen.getByRole('heading', { name: /what did White play next/i })).toBeInTheDocument();
  });

  it('renders nothing when the response carries no moves (cold position / terminal)', () => {
    const { container } = render(<DecisionMenu fen={F1} nextMoves={[]} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('evidence-decision-menu')).toBeNull();
  });

  it('collapses a long menu and reveals the rest on demand', async () => {
    const user = userEvent.setup();
    render(<DecisionMenu fen={F1} nextMoves={najdorfMoves} />);

    // 21 rows > 6: only the first 6 visible; the rest behind the toggle.
    const initial = screen.getAllByTestId('evidence-menu-row');
    expect(initial.length).toBe(6);
    expect(initial[5].textContent).toContain('Bd3');
    expect(screen.getByText('Show 15 more')).toBeInTheDocument();

    await user.click(screen.getByTestId('evidence-menu-toggle'));
    expect(screen.getAllByTestId('evidence-menu-row').length).toBe(21);
    expect(screen.queryByText(/Show \d+ more/)).toBeNull();
  });
});
