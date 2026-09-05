import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OpeningBook } from '@/features/analysis/openings';
import ReferencePanel from '@/features/analysis/ReferencePanel';
import type { CorpusBookStatus } from '@/features/analysis/useCorpusBook';
import type { BookMove, LegalMove } from '@/lib/api';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_D4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';

const book: OpeningBook = {
  // 1. e4 and 1. d4 from the start.
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': 'B00|King Pawn',
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': 'A40|Queen Pawn',
};

const ready = (moves: BookMove[]): CorpusBookStatus => ({ kind: 'ready', moves });
const LOADING: CorpusBookStatus = { kind: 'loading' };
const FAILED: CorpusBookStatus = { kind: 'failed' };

function renderPanel({
  fen = START,
  corpusStatus = ready([]),
  onPlayMove,
  onHoverMove = vi.fn(),
}: {
  fen?: string | null;
  corpusStatus?: CorpusBookStatus;
  onPlayMove?: (move: LegalMove) => void;
  onHoverMove?: (move: LegalMove | null) => void;
} = {}) {
  return render(
    <ReferencePanel
      book={book}
      fen={fen}
      corpusStatus={corpusStatus}
      onPlayMove={onPlayMove}
      onHoverMove={onHoverMove}
    />,
  );
}

describe('ReferencePanel', () => {
  it('lists the named continuations of a corpus-empty position', () => {
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

  it('names the position itself when the book keys it', () => {
    // The panel names where you are, not just where you could go — a
    // transposition's destination reads as its book line.
    renderPanel({ fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' });
    expect(screen.getByTestId('reference-position-name')).toHaveTextContent('B00 · King Pawn');
  });

  it('shows no position name off-book', () => {
    // After 1. a3 — not keyed in the fixture book.
    renderPanel({ fen: 'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq - 0 1' });
    expect(screen.queryByTestId('reference-position-name')).not.toBeInTheDocument();
  });

  it('shows the placeholder off-book and for a null position', () => {
    renderPanel({ fen: AFTER_D4 });
    expect(screen.getByText('No named continuations from this position.')).toBeInTheDocument();

    renderPanel({ fen: null });
    expect(screen.getAllByText('No named continuations from this position.')).toHaveLength(2);
  });

  it('leads with the corpus rows when the corpus knows the position', () => {
    // The corpus row carries the count, the W/D/B bar, and the named label
    // (the child position is keyed) — the d4 named row yields to the
    // corpus-primary shape.
    renderPanel({
      corpusStatus: ready([{ move: 'e4', games: 100, white: 50, draw: 30, black: 20 }]),
    });

    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('B00 · King Pawn')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByTestId('reference-rate-bar')).toBeInTheDocument();
    expect(screen.queryByText('d4')).not.toBeInTheDocument();
  });

  it('renders corpus rows without a named label when the child is unkeyed', () => {
    renderPanel({
      fen: AFTER_D4,
      corpusStatus: ready([{ move: 'Nf6', games: 42, white: 20, draw: 10, black: 12 }]),
      onPlayMove: vi.fn(),
    });

    expect(screen.getByText('Nf6')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByTestId('reference-rate-bar')).toBeInTheDocument();
    // The row stays interactive without a named label.
    expect(screen.getByText('Nf6').closest('button')).not.toBeDisabled();
  });

  it('merges annotated corpus SANs into one row', () => {
    // The corpus stores SANs as played: one logical move can span annotated
    // rows ("e4?!" beside "e4"). The panel shows one merged row.
    renderPanel({
      corpusStatus: ready([
        { move: 'e4', games: 100, white: 50, draw: 30, black: 20 },
        { move: 'e4?!', games: 5, white: 1, draw: 2, black: 2 },
      ]),
    });

    expect(screen.getAllByText('e4')).toHaveLength(1);
    expect(screen.getByText('105')).toBeInTheDocument();
    expect(screen.getAllByTestId('reference-rate-bar')).toHaveLength(1);
  });

  it('corpus rows preview and play like book rows', () => {
    const onHoverMove = vi.fn();
    const onPlayMove = vi.fn<(move: LegalMove) => void>();
    renderPanel({
      corpusStatus: ready([{ move: 'e4', games: 100, white: 50, draw: 30, black: 20 }]),
      onHoverMove,
      onPlayMove,
    });

    fireEvent.mouseEnter(screen.getByText('e4'));
    expect(onHoverMove).toHaveBeenCalledWith(expect.objectContaining({ from: 'e2', to: 'e4' }));
    fireEvent.click(screen.getByText('e4'));
    expect(onPlayMove).toHaveBeenCalledWith(expect.objectContaining({ san: 'e4' }));
  });

  it('shows a loading indicator while the stats are in flight', () => {
    // The named rows render immediately (the book is local); the stats area
    // signals loading.
    renderPanel({ corpusStatus: LOADING });

    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByTestId('reference-stats-loading')).toBeInTheDocument();
  });

  it('does not declare "no continuations" while the corpus verdict is in flight', () => {
    // A position without named continuations may still have corpus rows —
    // the empty message must wait for the corpus answer.
    renderPanel({ fen: AFTER_D4, corpusStatus: LOADING });

    expect(
      screen.queryByText('No named continuations from this position.'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('reference-stats-loading')).toBeInTheDocument();
  });

  it('surfaces a failed stats fetch instead of silent empty rows', () => {
    renderPanel({ corpusStatus: FAILED });

    expect(screen.getByTestId('reference-stats-failed')).toBeInTheDocument();
    expect(screen.queryByTestId('reference-stats-loading')).not.toBeInTheDocument();
    // The named rows still render on failure (the book is local).
    expect(screen.getByText('e4')).toBeInTheDocument();
  });
});
