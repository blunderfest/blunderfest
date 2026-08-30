import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isEndgameFen } from '@/features/analysis/gamePhases';
import {
  type BookContinuation,
  continuationsFor,
  type OpeningBook,
} from '@/features/analysis/openings';
import ReferencePanel from '@/features/analysis/ReferencePanel';
import DecisionMenu from '@/features/historicalEvidence/DecisionMenu';
import { cachedResult, requestKey } from '@/features/historicalEvidence/evidenceCache';
import type { HistoricalEvidenceResult } from '@/features/historicalEvidence/types';
import type { LegalMove } from '@/lib/api';

type FindStatus = { kind: 'idle' } | { kind: 'loading' } | { kind: 'failed' };

/**
 * Positional context — what Blunderfest knows about the current board
 * position, with an explicit way to ask for more expensive knowledge
 * (ADR-0024 as amended by the position-context UI task).
 *
 * Priority (explicit, not a plugin framework): tablebase (reserved
 * extension point — no TB source exists in the repo yet; the state's
 * first check is where one would land) > opening book (cheap, already
 * indexed via `continuationsFor`) > historical evidence (expensive — the
 * CTA refuses to auto-run; a remembered result renders the decision-menu
 * summary).
 *
 * The kind of knowledge is recomputed on every position change (the
 * cache is keyed on `[fen, route, refPly]`), so nothing is stale across
 * navigation. The find-CTA's request is forked per render — a stale
 * resolution is discarded by comparing the mounted cursor.
 */
export default function PositionContext({
  book,
  bookContinuations = null,
  fen,
  route = null,
  refPly = null,
  canPlay = true,
  onPlayMove,
  onHoverMove,
  onFindEvidence,
  onViewEvidence,
}: {
  book: OpeningBook | null;
  /** Pre-computed continuations (optional — avoids a rerender loop
      between sidebar render and lookup). */
  bookContinuations?: BookContinuation[] | null;
  fen: string | null;
  route?: string[] | null;
  refPly?: number | null;
  canPlay?: boolean;
  onPlayMove?: (move: LegalMove) => void;
  onHoverMove: (move: LegalMove | null) => void;
  /** Runs the evidence query for the current position (Analysis performs
      the request and writes the result into the session cache). */
  onFindEvidence?: () => Promise<HistoricalEvidenceResult | null>;
  /** Opens the evidence dialog for the current position — the slot's
      request, becomes a cache hit. */
  onViewEvidence?: () => void;
}) {
  const { t } = useTranslation();
  const [findStatus, setFindStatus] = useState<FindStatus>({ kind: 'idle' });
  /** The last successful result — local state so the cache write re-renders. */
  const [resolved, setResolved] = useState<HistoricalEvidenceResult | null>(null);

  // The request identity for the rendered position — one key shape, built
  // once per render, shared by the reset compare and the cache read.
  const key = fen !== null ? requestKey(fen, route ?? null, refPly ?? null) : null;

  // Reset the local resolution whenever the cursor's request changes (fen,
  // route, or refPly) — a resolved result belongs to the position that
  // produced it, not the one currently rendered. Render-time compare (the
  // documented adjust-state-during-render pattern) avoids an effect round.
  const [previousKey, setPreviousKey] = useState<string | null>(key);
  if (previousKey !== key) {
    setPreviousKey(key);
    setFindStatus({ kind: 'idle' });
    setResolved(null);
  }

  const continuations = bookContinuations ?? (book === null ? [] : continuationsFor(book, fen));
  const bookAvailable = continuations.length > 0;
  // `resolved` re-renders here even though the cache writes outside React:
  // it carries the same value the cache lookup would find.
  const cached = resolved ?? (key !== null ? cachedResult(key) : undefined);

  async function runFind() {
    if (onFindEvidence === undefined) {
      return;
    }
    try {
      const result = await onFindEvidence();
      if (result !== null) {
        setResolved(result);
        setFindStatus({ kind: 'idle' });
      }
    } catch {
      setFindStatus({ kind: 'failed' });
    }
  }

  let content = (
    <ReferencePanel
      book={book}
      fen={fen}
      onPlayMove={canPlay ? onPlayMove : undefined}
      onHoverMove={onHoverMove}
    />
  );

  if (!bookAvailable) {
    // The tablebase hook (v0's endgame book extension point): out of book
    // and into an endgame, the panel names the state — the reserved slot a
    // tablebase source would fill once one exists in the repo.
    const tablebaseNote =
      fen !== null && isEndgameFen(fen) ? (
        <p
          className="m-0 flex items-center gap-1.5 px-3 pt-2 text-micro text-faint"
          data-testid="position-context-endgame"
        >
          {t('positionContext.endgameHook')}
        </p>
      ) : null;

    content =
      cached !== undefined ? (
        // Historical evidence already calculated — summary + View. The
        // sticky "Positional context" title already names the box, so the
        // section goes straight to the counts (no repeated header).
        <div className="flex min-h-0 flex-col" data-testid="position-context-evidence">
          {tablebaseNote}
          <section className="flex flex-col gap-0.5 px-3 py-2 text-left">
            <p className="m-0 text-note text-ink">
              {t('positionContext.gamesCount', { count: cached.reference.games })}
            </p>
          </section>
          <DecisionMenu
            fen={cached.reference.fen}
            nextMoves={cached.reference.next_moves ?? null}
          />
          {onViewEvidence !== undefined && (
            <button
              type="button"
              className="border-t border-line px-3 py-1.5 text-left text-note text-gold-hi transition-colors hover:bg-raised hover:text-ink"
              onClick={() => onViewEvidence()}
              data-testid="position-context-view-evidence"
            >
              {t('positionContext.view')} →
            </button>
          )}
        </div>
      ) : (
        // Historical evidence absent — explicit CTA (no auto-run). Centered,
        // no repeated header: the sticky "Position context" title already
        // names the box, and the button hugs its label.
        <div
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-3 py-4"
          data-testid="position-context-find"
        >
          {tablebaseNote}
          {findStatus.kind === 'failed' ? (
            <>
              <p className="m-0 text-note text-bad-hi">{t('positionContext.failed')}</p>
              <button
                type="button"
                className="self-center rounded-control border border-line px-3 py-1.5 text-ui font-semibold text-ink transition-colors hover:bg-raised"
                onClick={() => {
                  setFindStatus({ kind: 'loading' });
                  void runFind();
                }}
                data-testid="position-context-retry"
              >
                {t('positionContext.retry')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="self-center rounded-control border border-line px-3 py-1.5 text-ui font-semibold text-ink transition-colors hover:bg-raised disabled:opacity-50"
              disabled={findStatus.kind === 'loading'}
              onClick={() => {
                setFindStatus({ kind: 'loading' });
                void runFind();
              }}
              data-testid="position-context-find-button"
            >
              {findStatus.kind === 'loading'
                ? t('positionContext.finding')
                : t('positionContext.find')}
            </button>
          )}
        </div>
      );
  }

  return (
    <section
      className="flex h-64 shrink-0 flex-col overflow-y-auto border-b border-line"
      data-testid="position-context"
      aria-label={t('positionContext.title')}
    >
      <h3 className="sticky top-0 m-0 flex shrink-0 items-center gap-2 bg-panel px-3 py-1.5 text-micro font-semibold uppercase tracking-[0.11em] text-muted">
        {t('positionContext.title')}
      </h3>
      {content}
    </section>
  );
}
