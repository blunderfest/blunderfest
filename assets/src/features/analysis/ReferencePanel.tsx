import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { continuationsFor, type OpeningBook } from '@/features/analysis/openings';
import type { LegalMove } from '@/lib/api';

/**
 * The Reference tab (ADR-0024): per-position reference data following the
 * board cursor. v0 is corpus-free — the named continuations of the static
 * opening book; the corpus upgrade adds games/W-D-L statistics to the same
 * rows without changing the tab.
 *
 * Rows are a third way to play a move (alongside the board and the move
 * list): hovering previews the move as a translucent ghost arrow on the
 * board (local, never broadcast); clicking plays it as a real op for the
 * whole room — broadcast is the collaborative point (ADR-0024, revised).
 * Viewers preview but cannot play.
 */
export default function ReferencePanel({
  book,
  fen,
  onPlayMove,
  onHoverMove,
}: {
  book: OpeningBook | null;
  /** The board cursor's position. */
  fen: string | null;
  /** Play the move for the room (a real, broadcast op) — editors only. */
  onPlayMove?: (move: LegalMove) => void;
  /** Preview the move as a ghost arrow while hovered (local, everyone). */
  onHoverMove: (move: LegalMove | null) => void;
}) {
  const { t } = useTranslation();
  const continuations = useMemo(
    () => (book === null ? [] : continuationsFor(book, fen)),
    [book, fen],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="reference-panel">
      {continuations.length === 0 ? (
        <p className="m-0 p-3 text-note text-faint">{t('analysis.referenceEmpty')}</p>
      ) : (
        <ul
          className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1"
          data-testid="reference-list"
        >
          {continuations.map((continuation) => (
            // Hover handlers sit on the li: disabled buttons (viewers) don't
            // fire mouse events, but the ghost preview is for everyone.
            <li
              key={continuation.san}
              onMouseEnter={() => onHoverMove(continuation)}
              onMouseLeave={() => onHoverMove(null)}
            >
              <button
                type="button"
                className="flex w-full items-baseline gap-2 rounded-control px-2 py-1.5 text-left transition-colors not-disabled:hover:bg-raised disabled:cursor-default"
                disabled={onPlayMove === undefined}
                onClick={() => onPlayMove?.(continuation)}
              >
                <span className="shrink-0 text-ui font-semibold text-ink tabular-nums">
                  {continuation.san}
                </span>
                <span className="min-w-0 flex-1 truncate text-right text-note text-muted">
                  {continuation.eco} · {continuation.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
