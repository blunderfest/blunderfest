import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OpeningBook } from '@/features/analysis/openings';
import ReferencePanel from '@/features/analysis/ReferencePanel';
import type { LegalMove } from '@/lib/api';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_D4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';

const book: OpeningBook = {
  // 1. e4 and 1. d4 from the start, 1... e5 after 1. e4.
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': 'B00|King Pawn',
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': 'A40|Queen Pawn',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': 'C20|Open Game',
};

function renderPanel(fen: string | null = START, onInsertLine?: (moves: LegalMove[]) => void) {
  return render(<ReferencePanel book={book} fen={fen} onInsertLine={onInsertLine} />);
}

describe('ReferencePanel', () => {
  it('lists the named continuations of the position', () => {
    renderPanel();

    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('B00 · King Pawn')).toBeInTheDocument();
    expect(screen.getByText('d4')).toBeInTheDocument();
    expect(screen.getByText('A40 · Queen Pawn')).toBeInTheDocument();
  });

  it('descends locally on click — no ops, breadcrumb walks back', () => {
    renderPanel();

    fireEvent.click(screen.getByText('e4'));

    // One ply down: e5 is the continuation, the breadcrumb shows the path.
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('C20 · Open Game')).toBeInTheDocument();
    expect(screen.getByTestId('reference-back')).toHaveTextContent('e4');

    fireEvent.click(screen.getByTestId('reference-back'));

    expect(screen.getByText('B00 · King Pawn')).toBeInTheDocument();
    expect(screen.queryByTestId('reference-back')).not.toBeInTheDocument();
  });

  it('re-anchors to the board cursor when it moves', () => {
    const { rerender } = render(
      <ReferencePanel book={book} fen={START} onInsertLine={undefined} />,
    );
    fireEvent.click(screen.getByText('e4'));
    expect(screen.getByTestId('reference-back')).toBeInTheDocument();

    rerender(<ReferencePanel book={book} fen={AFTER_D4} onInsertLine={undefined} />);

    // The descent reset; the new position has no book continuations.
    expect(screen.queryByTestId('reference-back')).not.toBeInTheDocument();
    expect(screen.getByText('No named continuations from this position.')).toBeInTheDocument();
  });

  it('inserts the browsed path as a variation (editors)', () => {
    const onInsertLine = vi.fn<(moves: LegalMove[]) => void>();
    renderPanel(START, onInsertLine);

    // Nothing to insert before descending.
    expect(screen.queryByTestId('reference-insert-button')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('e4'));
    fireEvent.click(screen.getByText('e5'));
    fireEvent.click(screen.getByTestId('reference-insert-button'));

    expect(onInsertLine).toHaveBeenCalledTimes(1);
    const moves = onInsertLine.mock.calls[0][0];
    expect(moves.map((m) => m.san)).toEqual(['e4', 'e5']);
    expect(moves[1].fen).toContain('4p3');
  });

  it('offers no insert to viewers', () => {
    renderPanel(START, undefined);

    fireEvent.click(screen.getByText('e4'));

    expect(screen.queryByTestId('reference-insert-button')).not.toBeInTheDocument();
  });

  it('shows the placeholder off-book and for a null position', () => {
    renderPanel(AFTER_D4);
    expect(screen.getByText('No named continuations from this position.')).toBeInTheDocument();

    render(<ReferencePanel book={book} fen={null} onInsertLine={undefined} />);
    expect(
      screen.getAllByText('No named continuations from this position.').length,
    ).toBeGreaterThan(1);
  });
});
