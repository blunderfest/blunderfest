import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OpeningBook } from '@/features/analysis/openings';
import ReferencePanel from '@/features/analysis/ReferencePanel';
import type { LegalMove } from '@/lib/api';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_D4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';

const book: OpeningBook = {
  // 1. e4 and 1. d4 from the start.
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': 'B00|King Pawn',
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': 'A40|Queen Pawn',
};

function renderPanel({
  fen = START,
  onPlayMove,
  onHoverMove = vi.fn(),
}: {
  fen?: string | null;
  onPlayMove?: (move: LegalMove) => void;
  onHoverMove?: (move: LegalMove | null) => void;
} = {}) {
  return render(
    <ReferencePanel book={book} fen={fen} onPlayMove={onPlayMove} onHoverMove={onHoverMove} />,
  );
}

describe('ReferencePanel', () => {
  it('lists the named continuations of the position', () => {
    renderPanel();

    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('B00 · King Pawn')).toBeInTheDocument();
    expect(screen.getByText('d4')).toBeInTheDocument();
    expect(screen.getByText('A40 · Queen Pawn')).toBeInTheDocument();
  });

  it('previews the hovered move as a ghost arrow (local only)', () => {
    const onHoverMove = vi.fn();
    renderPanel({ onHoverMove });

    fireEvent.mouseEnter(screen.getByText('e4'));
    expect(onHoverMove).toHaveBeenCalledWith(expect.objectContaining({ from: 'e2', to: 'e4' }));

    fireEvent.mouseLeave(screen.getByText('e4'));
    expect(onHoverMove).toHaveBeenLastCalledWith(null);
  });

  it('plays the move on click (editors)', () => {
    const onPlayMove = vi.fn<(move: LegalMove) => void>();
    renderPanel({ onPlayMove });

    fireEvent.click(screen.getByText('e4'));

    expect(onPlayMove).toHaveBeenCalledWith(
      expect.objectContaining({ san: 'e4', from: 'e2', to: 'e4', promotion: null }),
    );
  });

  it('viewers preview but cannot play', () => {
    const onHoverMove = vi.fn();
    renderPanel({ onPlayMove: undefined, onHoverMove });

    const e4 = screen.getByText('e4').closest('button');
    expect(e4).toBeDisabled();

    // The ghost preview still works — it rides the li, not the button.
    fireEvent.mouseEnter(screen.getByText('e4'));
    expect(onHoverMove).toHaveBeenCalledWith(expect.objectContaining({ san: 'e4' }));
  });

  it('shows the placeholder off-book and for a null position', () => {
    renderPanel({ fen: AFTER_D4 });
    expect(screen.getByText('No named continuations from this position.')).toBeInTheDocument();

    renderPanel({ fen: null });
    expect(screen.getAllByText('No named continuations from this position.')).toHaveLength(2);
  });
});
