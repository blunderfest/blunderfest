import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowIcon from '@/components/ArrowIcon';
import { button } from '@/components/ui';
import {
  type BookContinuation,
  continuationsFor,
  type OpeningBook,
} from '@/features/analysis/openings';
import type { LegalMove } from '@/lib/api';

/**
 * The Reference tab (ADR-0024): per-position reference data, following the
 * board cursor. v0 is corpus-free — the named continuations of the static
 * opening book. The corpus upgrade adds games/W-D-L statistics to the same
 * rows without changing the tab.
 *
 * Descending is local (clicking a continuation walks the panel, never the
 * shared tree — exploring openings must not write ops); the path
 * re-anchors whenever the board cursor moves. Editors can insert the
 * browsed path as a variation — the same gesture as engine lines.
 */
export default function ReferencePanel({
  book,
  fen,
  onInsertLine,
}: {
  book: OpeningBook | null;
  /** The board cursor's position; the panel re-anchors to it. */
  fen: string | null;
  /** Insert the browsed path as a variation (editors only). */
  onInsertLine?: (moves: LegalMove[]) => void;
}) {
  const { t } = useTranslation();
  // The descent: book moves applied on top of the anchor (board) position.
  const [anchor, setAnchor] = useState(fen);
  const [path, setPath] = useState<BookContinuation[]>([]);
  if (anchor !== fen) {
    // Re-anchor synchronously — no flash of continuations for the old
    // position (React's supported adjust-state-during-render pattern).
    setAnchor(fen);
    setPath([]);
  }

  const browsedFen = path.length > 0 ? path[path.length - 1].fen : anchor;
  const continuations = useMemo(
    () => (book === null ? [] : continuationsFor(book, browsedFen)),
    [book, browsedFen],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="reference-panel">
      {path.length > 0 && (
        <button
          type="button"
          data-testid="reference-back"
          title={t('analysis.referenceBack')}
          aria-label={t('analysis.referenceBack')}
          className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-1.5 text-left text-note text-muted transition-colors hover:bg-raised hover:text-ink"
          onClick={() => setPath([])}
        >
          <ArrowIcon of="left" className="h-3 w-3 shrink-0" />
          <span className="truncate tabular-nums">{path.map((move) => move.san).join(' ')}</span>
        </button>
      )}
      {continuations.length === 0 ? (
        <p className="m-0 p-3 text-note text-faint">{t('analysis.referenceEmpty')}</p>
      ) : (
        <ul
          className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1"
          data-testid="reference-list"
        >
          {continuations.map((continuation) => (
            <li key={continuation.san}>
              <button
                type="button"
                className="flex w-full items-baseline gap-2 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-raised"
                onClick={() => setPath([...path, continuation])}
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
      {onInsertLine !== undefined && path.length > 0 && (
        <div className="shrink-0 border-t border-line p-2">
          <button
            type="button"
            data-testid="reference-insert-button"
            className={button({ intent: 'secondary', size: 'sm', block: true })}
            onClick={() => onInsertLine(path)}
          >
            {t('analysis.insertLine')}
          </button>
        </div>
      )}
    </div>
  );
}
