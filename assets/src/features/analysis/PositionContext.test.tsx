import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpeningBook } from '@/features/analysis/openings';
import PositionContext, { resetTranspositionCache } from '@/features/analysis/PositionContext';
import {
  rememberResult,
  requestKey,
  resetHistoricalEvidenceCache,
} from '@/features/historicalEvidence/evidenceCache';
import type {
  EvidenceCandidate,
  GameMeta,
  HistoricalEvidenceResult,
} from '@/features/historicalEvidence/types';
import type { LegalMove } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return { ...original, fetchBookCounts: vi.fn() };
});

const { fetchBookCounts } = await import('@/lib/api');
const mockFetchBookCounts = vi.mocked(fetchBookCounts);

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Genuinely out of book: not keyed, and no legal child is keyed either
// (1. a3 lands nowhere in the fixture book).
const OFF_BOOK = 'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq - 0 1';
const OFF_BOOK_2 = 'rnbqkbnr/ppp1pppp/8/3p4/8/P7/1PPPPPPP/RNBQKBNR w KQkq - 0 2';
// A king-and-pawn endgame, out of book (no queens, both sides ≤ 13 material).
const ENDGAME = '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1';

const book: OpeningBook = {
  // The start position is deliberately NOT keyed — the real book has no
  // entry for it (lichess's chess-openings starts after the first move);
  // it counts as in-book by definition (see openings.ts). Its named
  // continuations (e4, d4) are the rows.
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': 'B00|King Pawn',
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': 'A40|Queen Pawn',
};

function candidateStub(gid: number, meta?: Partial<GameMeta>): EvidenceCandidate {
  return {
    id: `exact-${gid}-1`,
    strategy: 'exact',
    stm: 'w',
    fen: OFF_BOOK,
    gid,
    ply: 1,
    game: {
      gid,
      white: `White${gid}`,
      black: `Black${gid}`,
      result: '1-0',
      date: '2017.05.01',
      eco: 'A00',
      opening: 'Fixture',
      white_elo: null,
      black_elo: null,
      event: 'Fixture',
      time_control: '300+0',
      site: 'fix',
      ...meta,
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
      shared_plies: 1,
      ref_ply: 1,
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
        status: 'no_menu',
        member_of: null,
        sim: null,
        family_occurrences: null,
        family_games: null,
      },
      skeleton: {
        white: {
          status: 'no_menu',
          family_id: null,
          sim: null,
          family_occurrences: null,
          family_games: null,
        },
        black: {
          status: 'no_menu',
          family_id: null,
          sim: null,
          family_occurrences: null,
          family_games: null,
        },
      },
    },
    historical: { occurrences: 1, games: 1, same_game_only: false },
    flags: [],
  };
}

// The fixture's exact-match count is 0 on purpose: the summary must read
// the candidates (the dialog's examples), not the reference's games.
function evidenceResult(candidateCount: number, fen: string = OFF_BOOK): HistoricalEvidenceResult {
  return {
    reference: {
      fen,
      occurrences: 1,
      games: 0,
      families: [],
      next_moves: [
        { move: 'd4', games: 3 },
        { move: 'e4', games: 1 },
      ],
    },
    candidates: Array.from({ length: candidateCount }, (_, i) => candidateStub(i + 1)),
    timings: {
      candidates_ms: 1,
      menu_ms: 1,
      evidence_ms: 1,
      total_ms: 1,
    },
  };
}

beforeEach(() => {
  resetHistoricalEvidenceCache();
  resetTranspositionCache();
  // Default: no corpus support for the transposition candidates.
  mockFetchBookCounts.mockResolvedValue({});
});

function renderPanel({
  fen = START,
  gameHeaders,
  onFindEvidence,
  onViewEvidence,
  onPlayMove,
  onHoverMove = vi.fn(),
}: {
  fen?: string | null;
  gameHeaders?: Record<string, string>;
  onFindEvidence?: () => Promise<HistoricalEvidenceResult | null>;
  onViewEvidence?: () => void;
  onPlayMove?: (move: LegalMove) => void;
  onHoverMove?: (move: LegalMove | null) => void;
} = {}) {
  return render(
    <PositionContext
      book={book}
      fen={fen}
      gameHeaders={gameHeaders}
      onFindEvidence={onFindEvidence}
      onViewEvidence={onViewEvidence}
      onPlayMove={onPlayMove}
      onHoverMove={onHoverMove}
    />,
  );
}

describe('PositionContext', () => {
  it('renders the opening book when the position is available', () => {
    renderPanel();
    expect(screen.getByTestId('position-context')).toBeInTheDocument();
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('B00 · King Pawn')).toBeInTheDocument();
    expect(screen.queryByTestId('position-context-find')).not.toBeInTheDocument();
  });

  it('treats the unkeyed start position as in-book (no transposition framing)', () => {
    // Regression: the chess-openings corpus has no entry for the bare start
    // position — a fresh board must show the book, not "outside the book".
    renderPanel();
    expect(screen.getByTestId('reference-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('position-context-transpositions')).not.toBeInTheDocument();
    expect(screen.queryByText('Possible transpositions')).not.toBeInTheDocument();
  });

  it('renders the find-CTA when the book has nothing', () => {
    renderPanel({ fen: OFF_BOOK });
    expect(screen.getByTestId('position-context-find')).toBeInTheDocument();
    // No evidence request fires until the user clicks.
    expect(screen.queryByTestId('position-context-evidence')).not.toBeInTheDocument();
  });

  it('names the endgame (tablebase hook) when out of book in an endgame', () => {
    renderPanel({ fen: ENDGAME });
    expect(screen.getByTestId('position-context-endgame')).toBeInTheDocument();
    expect(screen.queryByTestId('position-context-find')).toBeInTheDocument();
  });

  it('no endgame hook in a middlegame out-of-book position', () => {
    renderPanel({ fen: OFF_BOOK });
    expect(screen.queryByTestId('position-context-endgame')).not.toBeInTheDocument();
  });

  it('shows one-ply transpositions when out of book but a child lands back in it', async () => {
    // After 1. a3 (out of book), 1... e5 lands on a book-keyed position.
    // The book is keyed by resulting position (placement + side + castling).
    const childFen = 'rnbqkbnr/pppp1ppp/8/4p3/8/P7/1PPPPPPP/RNBQKBNR w KQkq - 0 2';
    const transposingBook: OpeningBook = {
      'rnbqkbnr/pppp1ppp/8/4p3/8/P7/1PPPPPPP/RNBQKBNR w KQkq': 'A00|a3 then …e5',
    };
    const afterA3 = 'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq - 0 1';
    mockFetchBookCounts.mockResolvedValue({ [childFen]: 24 });

    render(
      <PositionContext
        book={transposingBook}
        fen={afterA3}
        onPlayMove={vi.fn()}
        onHoverMove={vi.fn()}
      />,
    );

    expect(screen.getByTestId('position-context-transpositions')).toBeInTheDocument();
    expect(screen.getByText('Possible transpositions')).toBeInTheDocument();
    expect(screen.getByTestId('position-context-transposition')).toBeInTheDocument();
    // No find-CTA while a transposition exists.
    expect(screen.queryByTestId('position-context-find')).not.toBeInTheDocument();
    // The corpus count lands for the transposing child.
    await waitFor(() => expect(mockFetchBookCounts).toHaveBeenCalled());
  });

  it('runs the evidence query on the CTA and shows the summary', async () => {
    const onFindEvidence = vi.fn<() => Promise<HistoricalEvidenceResult | null>>(() =>
      Promise.resolve(evidenceResult(5)),
    );
    renderPanel({ fen: OFF_BOOK, onFindEvidence });
    const button = screen.getByTestId('position-context-find-button');
    fireEvent.click(button);
    expect(button).toBeDisabled();
    await screen.findByText('d4');
    expect(onFindEvidence).toHaveBeenCalled();
    expect(screen.getByTestId('position-context-evidence')).toBeInTheDocument();
    expect(screen.getByText('5 games')).toBeInTheDocument();
  });

  it('View evidence opens the dialog without re-running', async () => {
    const onFindEvidence = vi.fn<() => Promise<HistoricalEvidenceResult | null>>(() =>
      Promise.resolve(evidenceResult(5)),
    );
    const onViewEvidence = vi.fn();
    renderPanel({ fen: OFF_BOOK, onFindEvidence, onViewEvidence });
    fireEvent.click(screen.getByTestId('position-context-find-button'));
    await screen.findByText('d4');
    fireEvent.click(screen.getByTestId('position-context-view-evidence'));
    expect(onViewEvidence).toHaveBeenCalled();
  });

  it('excludes the analyzed game itself from the summary count', async () => {
    const onFindEvidence = vi.fn<() => Promise<HistoricalEvidenceResult | null>>(() =>
      Promise.resolve({
        ...evidenceResult(0),
        candidates: [
          candidateStub(1),
          candidateStub(2),
          candidateStub(3, { white: 'SelfW', black: 'SelfB', result: '1-0' }),
        ],
      }),
    );
    renderPanel({
      fen: OFF_BOOK,
      gameHeaders: { White: 'SelfW', Black: 'SelfB', Result: '1-0' },
      onFindEvidence,
    });
    fireEvent.click(screen.getByTestId('position-context-find-button'));
    // Three candidates returned, the analyzed game filtered out — the count
    // matches the two rows the View dialog will list.
    await screen.findByText('2 games');
  });

  it('offers a retry on failure', async () => {
    const onFindEvidence = vi.fn<() => Promise<HistoricalEvidenceResult | null>>(() => {
      return Promise.reject(new Error('no'));
    });
    renderPanel({ fen: OFF_BOOK, onFindEvidence });
    fireEvent.click(screen.getByTestId('position-context-find-button'));
    const retry = await screen.findByTestId('position-context-retry');
    expect(retry).toBeEnabled();
  });

  it('resets to the find-CTA when the cursor moves after a resolution', async () => {
    const onFindEvidence = vi
      .fn<() => Promise<HistoricalEvidenceResult | null>>()
      .mockResolvedValueOnce(evidenceResult(5, OFF_BOOK))
      .mockResolvedValueOnce(evidenceResult(7, OFF_BOOK_2));
    const { rerender } = renderPanel({ fen: OFF_BOOK, onFindEvidence });
    fireEvent.click(screen.getByTestId('position-context-find-button'));
    await screen.findByText('5 games');
    expect(screen.getByTestId('position-context-evidence')).toBeInTheDocument();

    // The cursor moves to a new off-book position: the old summary must go
    // and the CTA must be runnable again.
    rerender(
      <PositionContext
        book={book}
        fen={OFF_BOOK_2}
        onFindEvidence={onFindEvidence}
        onHoverMove={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('position-context-evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('5 games')).not.toBeInTheDocument();
    const button = screen.getByTestId('position-context-find-button');
    expect(button).toBeEnabled();

    fireEvent.click(button);
    await screen.findByText('7 games');
    expect(onFindEvidence).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('position-context-evidence')).toBeInTheDocument();
  });

  it('renders evidence from the cache on cursor return (cached navigation)', async () => {
    // Mirrors Analysis.runFindEvidence's contract: the query's result is
    // remembered in the session cache before the promise resolves.
    const onFindEvidence = vi.fn<() => Promise<HistoricalEvidenceResult | null>>(() => {
      const result = evidenceResult(5);
      rememberResult(requestKey(OFF_BOOK, null, null), result);
      return Promise.resolve(result);
    });
    const { rerender } = renderPanel({ fen: OFF_BOOK, onFindEvidence });
    fireEvent.click(screen.getByTestId('position-context-find-button'));
    await waitFor(() => screen.getByText('d4'));
    rerender(
      <PositionContext
        book={book}
        fen={START}
        onFindEvidence={onFindEvidence}
        onHoverMove={vi.fn()}
      />,
    );
    expect(screen.getByText('e4')).toBeInTheDocument();
    rerender(
      <PositionContext
        book={book}
        fen={OFF_BOOK}
        onFindEvidence={onFindEvidence}
        onHoverMove={vi.fn()}
      />,
    );
    expect(screen.getByTestId('position-context-evidence')).toBeInTheDocument();
    expect(onFindEvidence).toHaveBeenCalledTimes(1);
  });
});
