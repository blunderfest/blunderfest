import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpeningBook } from '@/features/analysis/openings';
import PositionContext from '@/features/analysis/PositionContext';
import { resetHistoricalEvidenceCache } from '@/features/historicalEvidence/evidenceCache';
import type { HistoricalEvidenceResult } from '@/features/historicalEvidence/types';
import type { LegalMove } from '@/lib/api';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const OFF_BOOK = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';

const book: OpeningBook = {
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': 'B00|King Pawn',
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': 'A40|Queen Pawn',
};

function evidenceResult(games = 3): HistoricalEvidenceResult {
  return {
    reference: {
      fen: OFF_BOOK,
      occurrences: 1,
      games,
      families: [],
      next_moves: [
        { move: 'd4', games: 3 },
        { move: 'e4', games: 1 },
      ],
    },
    candidates: [],
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
});

function renderPanel({
  fen = START,
  onFindEvidence,
  onViewEvidence,
  onPlayMove,
  onHoverMove = vi.fn(),
}: {
  fen?: string | null;
  onFindEvidence?: () => Promise<HistoricalEvidenceResult | null>;
  onViewEvidence?: () => void;
  onPlayMove?: (move: LegalMove) => void;
  onHoverMove?: (move: LegalMove | null) => void;
} = {}) {
  return render(
    <PositionContext
      book={book}
      fen={fen}
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

  it('renders the find-CTA when the book has nothing', () => {
    renderPanel({ fen: OFF_BOOK });
    expect(screen.getByTestId('position-context-find')).toBeInTheDocument();
    // No evidence request fires until the user clicks.
    expect(screen.queryByTestId('position-context-evidence')).not.toBeInTheDocument();
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

  it('offers a retry on failure', async () => {
    const onFindEvidence = vi.fn<() => Promise<HistoricalEvidenceResult | null>>(() => {
      return Promise.reject(new Error('no'));
    });
    renderPanel({ fen: OFF_BOOK, onFindEvidence });
    fireEvent.click(screen.getByTestId('position-context-find-button'));
    const retry = await screen.findByTestId('position-context-retry');
    expect(retry).toBeEnabled();
  });

  it('renders evidence from the cache on cursor return (cached navigation)', async () => {
    const onFindEvidence = vi.fn<() => Promise<HistoricalEvidenceResult | null>>(() =>
      Promise.resolve(evidenceResult(5)),
    );
    const { rerender } = renderPanel({ fen: OFF_BOOK, onFindEvidence });
    fireEvent.click(screen.getByTestId('position-context-find-button'));
    await waitFor(() => screen.getByText('d4'));
    rerender(
      <PositionContext book={book} fen={START} onFindEvidence={onFindEvidence} onHoverMove={vi.fn()} />,
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
