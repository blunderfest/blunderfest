import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { phaseOf } from '@/features/analysis/gamePhases';
import { legalMovesFor } from '@/features/analysis/legalMoves';
import { isBookPosition, type OpeningBook } from '@/features/analysis/openings';
import ReferencePanel from '@/features/analysis/ReferencePanel';
import DecisionMenu from '@/features/historicalEvidence/DecisionMenu';
import { cachedResult, requestKey } from '@/features/historicalEvidence/evidenceCache';
import { isAnalyzedGame } from '@/features/historicalEvidence/HistoricalEvidenceDialog';
import type { HistoricalEvidenceResult } from '@/features/historicalEvidence/types';
import { fetchBookCounts, type LegalMove } from '@/lib/api';

type FindStatus = { kind: 'idle' } | { kind: 'loading' } | { kind: 'failed' };

/** The per-fen transposition-counts cache — module-scoped (one batched call). */
const transpositionCache = new Map<string, Record<string, number>>();

/** Test seam: drop the cached transposition counts. */
export function resetTranspositionCache(): void {
  transpositionCache.clear();
}

/**
 * The corpus game counts for the transposition candidate FENs (one batched
 * query per position). Returns a `fen → games` map, or null until it lands.
 */
function useTranspositionCounts(fens: string[]): Record<string, number> | null {
  // The sorted-join key is the list's identity; the array identity would
  // re-run the effect on every render.
  const key = fens.slice().sort().join('|');
  const [counts, setCounts] = useState<Record<string, number> | null>(
    key !== '' ? (transpositionCache.get(key) ?? null) : null,
  );

  useEffect(() => {
    const list = key === '' ? [] : key.split('|');
    if (list.length === 0) {
      setCounts(null);
      return;
    }
    const cached = transpositionCache.get(key);
    if (cached !== undefined) {
      setCounts(cached);
      return;
    }
    let cancelled = false;
    fetchBookCounts(list)
      .then((result) => {
        if (!cancelled) {
          transpositionCache.set(key, result);
          setCounts(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCounts(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return counts;
}

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
  fen,
  route = null,
  refPly = null,
  gameHeaders = {},
  canPlay = true,
  onPlayMove,
  onHoverMove,
  onFindEvidence,
  onViewEvidence,
}: {
  book: OpeningBook | null;
  fen: string | null;
  route?: string[] | null;
  refPly?: number | null;
  /** The analyzed game's PGN headers — its own corpus appearances are
      excluded from the summary count (the dialog filters them too). */
  gameHeaders?: Record<string, string>;
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

  // `resolved` re-renders here even though the cache writes outside React:
  // it carries the same value the cache lookup would find.
  const cached = resolved ?? (key !== null ? cachedResult(key) : undefined);

  // The position's phase (unified with the eval chart's endgame shading).
  const phase = fen !== null ? phaseOf(fen) : null;
  // In-book means the position itself is keyed (a position can have book
  // continuations without being in the book — the transposition case).
  const inBook = book !== null && isBookPosition(book, fen);
  // One-ply transpositions back into the book: legal children whose
  // resulting position is in the book. Local — the client holds the book.
  const transpositions = useMemo(() => {
    if (fen === null || book === null || inBook) {
      return [];
    }
    return legalMovesFor(fen).filter((move) => isBookPosition(book, move.fen));
  }, [fen, book, inBook]);

  // The corpus support for the transposing children (one batched call).
  const transpositionCounts = useTranspositionCounts(transpositions.map((m) => m.fen));

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

  // The phase notes that ride the out-of-book states: tablebase-eligible
  // (the reserved extension point — no TB source in the repo yet) and
  // likely-endgame. Shown on whichever out-of-book branch renders.
  const phaseNote =
    phase !== null && (phase.tablebaseEligible || phase.likelyEndgame) ? (
      <p
        className="m-0 flex items-center gap-1.5 px-3 pt-2 text-micro text-faint"
        data-testid="position-context-endgame"
      >
        {phase.tablebaseEligible
          ? t('positionContext.tablebaseHook')
          : t('positionContext.endgameHook')}
      </p>
    ) : null;

  if (!inBook) {
    content =
      // Out of book but a child lands back in it: the transposition note
      // replaces the plain book rows (the position itself has no named line).
      transpositions.length > 0 ? (
        // One-ply transposition back into the book: the position itself is
        // out, but these moves land back in it. Interactive rows — the
        // ghost preview and click-to-play match the book rows.
        <div className="flex min-h-0 flex-col" data-testid="position-context-transpositions">
          {phaseNote}
          <p className="m-0 px-3 pt-2 text-note text-muted">
            {t('positionContext.noDirectMatches')}
          </p>
          <p className="m-0 px-3 pb-1 text-micro font-semibold uppercase tracking-[0.11em] text-faint">
            {t('positionContext.possibleTranspositions')}
          </p>
          <ul className="m-0 list-none p-1">
            {[...transpositions]
              .sort(
                (a, b) =>
                  (transpositionCounts?.[b.fen] ?? 0) - (transpositionCounts?.[a.fen] ?? 0) ||
                  a.san.localeCompare(b.san),
              )
              .map((move) => (
                <li
                  key={move.san}
                  onMouseEnter={() => onHoverMove(move)}
                  onMouseLeave={() => onHoverMove(null)}
                >
                  <button
                    type="button"
                    className="flex w-full items-baseline gap-2 rounded-control px-2 py-1.5 text-left transition-colors not-disabled:hover:bg-raised disabled:cursor-default"
                    disabled={onPlayMove === undefined}
                    onClick={() => onPlayMove?.(move)}
                    data-testid="position-context-transposition"
                  >
                    <span className="shrink-0 text-ui font-semibold text-ink tabular-nums">
                      {move.san}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-micro text-faint tabular-nums">
                      {transpositionCounts?.[move.fen] !== undefined
                        ? t('positionContext.transpositionGames', {
                            count: transpositionCounts[move.fen],
                          })
                        : '…'}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ) : cached !== undefined ? (
        // Historical evidence already calculated — summary + View. The
        // sticky "Positional context" title already names the box, so the
        // section goes straight to the counts (no repeated header). The
        // count is what the View dialog will list — the visible candidates
        // (the analyzed game itself filtered out), not the reference
        // position's exact-match games: an off-book position has 0 exact
        // games yet can still surface a full list of similar examples.
        <div className="flex min-h-0 flex-col" data-testid="position-context-evidence">
          {phaseNote}
          <section className="flex flex-col gap-0.5 px-3 py-2 text-left">
            <p className="m-0 text-note text-ink">
              {t('positionContext.gamesCount', {
                count: cached.candidates.filter(
                  (candidate) => !isAnalyzedGame(candidate.game, gameHeaders),
                ).length,
              })}
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
          {phaseNote}
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
