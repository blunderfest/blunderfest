import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpeningBook } from '@/features/analysis/openings';
import PositionContext, { resetTranspositionCache } from '@/features/analysis/PositionContext';
import { resetBookStatsCache } from '@/features/analysis/useCorpusBook';
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
import type { BookMove, LegalMove } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return { ...original, fetchBook: vi.fn(), fetchBookCounts: vi.fn() };
});

const { fetchBook, fetchBookCounts } = await import('@/lib/api');
const mockFetchBook = vi.mocked(fetchBook);
const mockFetchBookCounts = vi.mocked(fetchBookCounts);

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Genuinely out of book: not keyed, and no legal child is keyed either
// (1. a3 lands nowhere in the fixture book).
const OFF_BOOK = 'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq - 0 1';
const OFF_BOOK_2 = 'rnbqkbnr/ppp1pppp/8/3p4/8/P7/1PPPPPPP/RNBQKBNR w KQkq - 0 2';
// A king-and-pawn endgame, out of book (no queens, both sides ≤ 13 material).
const ENDGAME = '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1';

// lichess 3eRBBiRt (Caro-Kann Defense: Endgame Variation) — the corpus
// covers the whole line, while the named book keys only the leaf
// positions (3.d3 "Endgame Offer", 5.Kxd1 "Endgame Variation").
const CARO_AFTER_D3 = 'rnbqkbnr/pp2pppp/2p5/3p4/4P3/3P1N2/PPP2PPP/RNBQKB1R b KQkq - 0 3';
const CARO_AFTER_DE4 = 'rnbqkbnr/pp2pppp/2p5/8/4P3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 4';
const CARO_AFTER_KXD1 = 'rnb1kbnr/pp2pppp/2p5/8/4P3/5N2/PPP2PPP/RNBK1B1R b kq - 0 5';
const CARO_AFTER_NF6 = 'rnb1kb1r/pp2pppp/2p2n2/8/4P3/5N2/PPP2PPP/RNBK1B1R w kq - 1 6';

const book: OpeningBook = {
  // The start position is deliberately NOT keyed — the real book has no
  // entry for it (lichess's chess-openings starts after the first move);
  // it counts as in-book by definition (see openings.ts). Its named
  // continuations (e4, d4) are the rows.
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': 'B00|King Pawn',
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': 'A40|Queen Pawn',
};

function candidateStub(
  gid: number,
  meta?: Partial<GameMeta>,
  strategy: EvidenceCandidate['strategy'] = 'exact',
): EvidenceCandidate {
  return {
    id: `${strategy}-${gid}-1`,
    strategy,
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

const corpusMove = (move: string, games: number): BookMove => ({
  move,
  games,
  white: Math.floor(games / 3),
  draw: Math.floor(games / 3),
  black: games - 2 * Math.floor(games / 3),
});

beforeEach(() => {
  resetHistoricalEvidenceCache();
  resetTranspositionCache();
  resetBookStatsCache();
  // Defaults: no corpus knowledge, no transposition support — the legacy
  // ladder runs unless a test teaches the corpus about the position.
  mockFetchBook.mockResolvedValue({ moves: [] });
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

  it('renders the find-CTA when neither book nor corpus has anything', async () => {
    renderPanel({ fen: OFF_BOOK });
    await screen.findByTestId('position-context-find');
    // No evidence request fires until the user clicks.
    expect(screen.queryByTestId('position-context-evidence')).not.toBeInTheDocument();
  });

  it('shows a loading state while the corpus verdict is in flight', () => {
    mockFetchBook.mockReturnValue(new Promise(() => {}));
    renderPanel({ fen: OFF_BOOK });
    // The branch can't be decided before the corpus answers — no premature
    // find-CTA flash.
    expect(screen.getByTestId('position-context-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('position-context-find')).not.toBeInTheDocument();
  });

  it('falls back to the legacy ladder when the corpus fetch fails', async () => {
    mockFetchBook.mockRejectedValue(new Error('network'));
    renderPanel({ fen: OFF_BOOK });
    await screen.findByTestId('position-context-find');
  });

  it('renders corpus rows when the corpus knows an out-of-book position', async () => {
    // The lichess 3eRBBiRt regression: after 4. dxe4 the named book has no
    // key and no keyed child (the find-CTA used to render), but the corpus
    // holds 900 games with Qxd1+.
    mockFetchBook.mockResolvedValue({
      moves: [{ move: 'Qxd1+', games: 900, white: 413, draw: 318, black: 169 }],
    });
    renderPanel({ fen: CARO_AFTER_DE4 });

    await screen.findByTestId('position-context-corpus');
    expect(screen.getByText('Qxd1+')).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByTestId('reference-rate-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('position-context-find')).not.toBeInTheDocument();
  });

  it('replaces the empty named-continuation message with corpus rows in book', async () => {
    // After 3. d3 the position is keyed (Endgame Offer) but no black reply
    // is — "No named continuations" used to render even though the corpus
    // knows the position.
    const keyedBook: OpeningBook = {
      'rnbqkbnr/pp2pppp/2p5/3p4/4P3/3P1N2/PPP2PPP/RNBQKB1R b KQkq':
        'B10|Caro-Kann Defense: Endgame Offer',
    };
    mockFetchBook.mockResolvedValue({
      moves: [corpusMove('dxe4', 988), corpusMove('Bg4', 485), corpusMove('g6', 444)],
    });
    render(<PositionContext book={keyedBook} fen={CARO_AFTER_D3} onHoverMove={vi.fn()} />);

    await screen.findByText('dxe4');
    expect(screen.getByText('988')).toBeInTheDocument();
    expect(
      screen.queryByText('No named continuations from this position.'),
    ).not.toBeInTheDocument();
  });

  it('follows the corpus mainline along the whole 3eRBBiRt opening', async () => {
    // No named book at all — the corpus alone carries every position of the
    // line, with the played move always among the rows.
    const corpusByFen: Record<string, BookMove[]> = {
      [CARO_AFTER_D3]: [corpusMove('dxe4', 988)],
      [CARO_AFTER_DE4]: [corpusMove('Qxd1+', 900)],
      [CARO_AFTER_KXD1]: [corpusMove('Nf6', 900)],
      [CARO_AFTER_NF6]: [corpusMove('Nbd2', 278), corpusMove('Nfd2', 186)],
    };
    mockFetchBook.mockImplementation(async (fen: string) => ({ moves: corpusByFen[fen] ?? [] }));

    const played = ['dxe4', 'Qxd1+', 'Nf6', 'Nbd2'];
    const fens = [CARO_AFTER_D3, CARO_AFTER_DE4, CARO_AFTER_KXD1, CARO_AFTER_NF6];
    const { rerender } = render(<PositionContext book={{}} fen={fens[0]} onHoverMove={vi.fn()} />);
    await screen.findByText(played[0]);

    for (let i = 1; i < fens.length; i++) {
      rerender(<PositionContext book={{}} fen={fens[i]} onHoverMove={vi.fn()} />);
      await screen.findByText(played[i]);
      expect(screen.queryByTestId('position-context-find')).not.toBeInTheDocument();
    }
  });

  it('shows corpus rows first and transpositions below when both apply', async () => {
    // After 1. a3 (out of book), 1... e5 lands on a book-keyed position AND
    // the corpus knows the position: corpus rows lead, the transposition
    // block rides below.
    const childFen = 'rnbqkbnr/pppp1ppp/8/4p3/8/P7/1PPPPPPP/RNBQKBNR w KQkq - 0 2';
    const transposingBook: OpeningBook = {
      'rnbqkbnr/pppp1ppp/8/4p3/8/P7/1PPPPPPP/RNBQKBNR w KQkq': 'A00|a3 then …e5',
    };
    const afterA3 = 'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq - 0 1';
    mockFetchBook.mockResolvedValue({ moves: [corpusMove('e5', 24)] });
    mockFetchBookCounts.mockResolvedValue({ [childFen]: 24 });

    render(
      <PositionContext
        book={transposingBook}
        fen={afterA3}
        onPlayMove={vi.fn()}
        onHoverMove={vi.fn()}
      />,
    );

    await screen.findByTestId('position-context-corpus');
    // The corpus row carries the named label (the child is keyed), and the
    // transposition block below names the same destination.
    expect(screen.getByText('Possible transpositions')).toBeInTheDocument();
    expect(screen.getByTestId('position-context-transposition')).toBeInTheDocument();
    expect(screen.getAllByText('A00 · a3 then …e5')).toHaveLength(2);
    const text = screen.getByTestId('position-context-corpus').textContent ?? '';
    expect(text.indexOf('Possible transpositions')).toBeGreaterThan(text.indexOf('e5'));
    // No find-CTA while the corpus knows the position.
    expect(screen.queryByTestId('position-context-find')).not.toBeInTheDocument();
    await waitFor(() => expect(mockFetchBookCounts).toHaveBeenCalled());
  });

  it('names the endgame (tablebase hook) when out of book in an endgame', async () => {
    renderPanel({ fen: ENDGAME });
    await screen.findByTestId('position-context-find');
    expect(screen.getByTestId('position-context-endgame')).toBeInTheDocument();
  });

  it('no endgame hook in a middlegame out-of-book position', async () => {
    renderPanel({ fen: OFF_BOOK });
    await screen.findByTestId('position-context-find');
    expect(screen.queryByTestId('position-context-endgame')).not.toBeInTheDocument();
  });

  it('shows one-ply transpositions when out of book but a child lands back in it', async () => {
    // After 1. a3 (out of book, corpus silent), 1... e5 lands on a
    // book-keyed position. The book is keyed by resulting position
    // (placement + side + castling).
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

    await screen.findByTestId('position-context-transpositions');
    expect(screen.getByText('Possible transpositions')).toBeInTheDocument();
    expect(screen.getByTestId('position-context-transposition')).toBeInTheDocument();
    // The row names the opening the transposition lands in.
    expect(screen.getByText('A00 · a3 then …e5')).toBeInTheDocument();
    // No find-CTA while a transposition exists.
    expect(screen.queryByTestId('position-context-find')).not.toBeInTheDocument();
    // The corpus count lands for the transposing child.
    await waitFor(() => expect(mockFetchBookCounts).toHaveBeenCalled());
  });

  it('runs the evidence query on the CTA and shows the summary', async () => {
    const onFindEvidence = vi.fn<() => Promise<HistoricalEvidenceResult | null>>(() =>
      Promise.resolve(evidenceResult(5)),
    );
    renderPanel({ fen: OFF_BOOK, onFindEvidence, onViewEvidence: vi.fn() });
    const button = await screen.findByTestId('position-context-find-button');
    fireEvent.click(button);
    expect(button).toBeDisabled();
    await screen.findByText('d4');
    expect(onFindEvidence).toHaveBeenCalled();
    expect(screen.getByTestId('position-context-evidence')).toBeInTheDocument();
    expect(screen.getByText('View 5 exact games →')).toBeInTheDocument();
  });

  it('hides the find CTA entirely when no handler exists (read-only viewer)', async () => {
    // A viewer clicking "Find historical evidence" used to stick on
    // "Finding…" forever: runFind early-returned on the undefined handler
    // while the button state was already set to loading.
    renderPanel({ fen: OFF_BOOK, onFindEvidence: undefined });
    await screen.findByTestId('position-context-find');
    expect(screen.queryByTestId('position-context-find-button')).not.toBeInTheDocument();
  });

  it('keeps the View-evidence link under corpus rows', async () => {
    // A remembered evidence result survives the corpus-primary upgrade: the
    // corpus rows lead, the dialog stays one click away.
    mockFetchBook.mockResolvedValue({ moves: [corpusMove('a6', 2)] });
    rememberResult(requestKey(OFF_BOOK, null, null), evidenceResult(5));
    renderPanel({ fen: OFF_BOOK, onViewEvidence: vi.fn() });

    await screen.findByTestId('position-context-corpus');
    expect(screen.getByText('a6')).toBeInTheDocument();
    expect(screen.getByTestId('position-context-view-evidence')).toHaveTextContent(
      'View 5 exact games →',
    );
  });

  it('splits exact and similar counts in the View link', async () => {
    const onFindEvidence = vi.fn<() => Promise<HistoricalEvidenceResult | null>>(() =>
      Promise.resolve({
        ...evidenceResult(0),
        candidates: [
          candidateStub(1),
          candidateStub(2),
          candidateStub(3),
          candidateStub(4),
          ...Array.from({ length: 10 }, (_, i) => candidateStub(i + 5, undefined, 'pawn_skeleton')),
        ],
      }),
    );
    renderPanel({ fen: OFF_BOOK, onFindEvidence, onViewEvidence: vi.fn() });
    fireEvent.click(await screen.findByTestId('position-context-find-button'));
    await screen.findByText('View 4 exact + 10 similar games →');
  });

  it('View evidence opens the dialog without re-running', async () => {
    const onFindEvidence = vi.fn<() => Promise<HistoricalEvidenceResult | null>>(() =>
      Promise.resolve(evidenceResult(5)),
    );
    const onViewEvidence = vi.fn();
    renderPanel({ fen: OFF_BOOK, onFindEvidence, onViewEvidence });
    fireEvent.click(await screen.findByTestId('position-context-find-button'));
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
      onViewEvidence: vi.fn(),
    });
    fireEvent.click(await screen.findByTestId('position-context-find-button'));
    // Three candidates returned, the analyzed game filtered out — the count
    // matches the two rows the View dialog will list.
    await screen.findByText('View 2 exact games →');
  });

  it('offers a retry on failure', async () => {
    const onFindEvidence = vi.fn<() => Promise<HistoricalEvidenceResult | null>>(() => {
      return Promise.reject(new Error('no'));
    });
    renderPanel({ fen: OFF_BOOK, onFindEvidence, onViewEvidence: vi.fn() });
    fireEvent.click(await screen.findByTestId('position-context-find-button'));
    const retry = await screen.findByTestId('position-context-retry');
    expect(retry).toBeEnabled();
  });

  it('resets to the find-CTA when the cursor moves after a resolution', async () => {
    const onFindEvidence = vi
      .fn<() => Promise<HistoricalEvidenceResult | null>>()
      .mockResolvedValueOnce(evidenceResult(5, OFF_BOOK))
      .mockResolvedValueOnce(evidenceResult(7, OFF_BOOK_2));
    const { rerender } = renderPanel({ fen: OFF_BOOK, onFindEvidence, onViewEvidence: vi.fn() });
    fireEvent.click(await screen.findByTestId('position-context-find-button'));
    await screen.findByText('View 5 exact games →');
    expect(screen.getByTestId('position-context-evidence')).toBeInTheDocument();

    // The cursor moves to a new off-book position: the old summary must go
    // and the CTA must be runnable again.
    rerender(
      <PositionContext
        book={book}
        fen={OFF_BOOK_2}
        onFindEvidence={onFindEvidence}
        onViewEvidence={vi.fn()}
        onHoverMove={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('position-context-evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('View 5 exact games →')).not.toBeInTheDocument();
    const button = await screen.findByTestId('position-context-find-button');
    expect(button).toBeEnabled();

    fireEvent.click(button);
    await screen.findByText('View 7 exact games →');
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
    const { rerender } = renderPanel({ fen: OFF_BOOK, onFindEvidence, onViewEvidence: vi.fn() });
    fireEvent.click(await screen.findByTestId('position-context-find-button'));
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
    // The corpus verdict for OFF_BOOK is module-cached from the first
    // visit, so the remembered evidence renders synchronously.
    await screen.findByTestId('position-context-evidence');
    expect(onFindEvidence).toHaveBeenCalledTimes(1);
  });
});
