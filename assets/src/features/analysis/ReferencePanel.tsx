import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { statusDot } from '@/components/ui';
import { corpusContinuationsFor, mergeCorpusMoves } from '@/features/analysis/corpusBook';
import { continuationsFor, type OpeningBook, openingAt } from '@/features/analysis/openings';
import type { CorpusBookStatus } from '@/features/analysis/useCorpusBook';
import type { BookMove, LegalMove } from '@/lib/api';

/**
 * The reference rows of the Positional Context panel (ADR-0024, corpus stats
 * per the phase-aware book): per-position reference data following the board
 * cursor. The corpus next-move distribution leads — the corpus book is keyed
 * by position like the corpus itself, so it covers positions the sparse,
 * leaf-keyed named book misses; the named book labels the corpus rows where
 * it keys the resulting position. Only when the corpus has nothing does the
 * plain named-continuation shape take over.
 *
 * Rows are a third way to play a move (alongside the board and the move
 * list): hovering a row previews the move as a translucent ghost arrow on
 * the board (local, never broadcast); clicking plays it as a real op for
 * the whole room — broadcast is the collaborative point (ADR-0024, revised).
 * Viewers preview but cannot play.
 */

/** The W/D/B rate bar under a row: three segments, labeled when wide enough. */
function RateBar({ stats }: { stats: BookMove }) {
  const total = Math.max(stats.games, 1);
  const w = Math.round((stats.white / total) * 100);
  const d = Math.round((stats.draw / total) * 100);
  const b = Math.max(0, 100 - w - d);
  return (
    <div
      className="mt-1 flex h-2 overflow-hidden rounded-[3px] border border-line"
      role="img"
      aria-label={`White ${w}%, draw ${d}%, black ${b}%`}
      data-testid="reference-rate-bar"
    >
      <span className="bg-[#e8e6df]" style={{ width: `${w}%` }} />
      <span className="bg-[#7a8499]" style={{ width: `${d}%` }} />
      <span className="bg-[#2e3442]" style={{ width: `${b}%` }} />
    </div>
  );
}

export default function ReferencePanel({
  book,
  fen,
  corpusStatus,
  onPlayMove,
  onHoverMove,
}: {
  book: OpeningBook | null;
  /** The board cursor's position. */
  fen: string | null;
  /** The corpus next-move stats for `fen` (fetched once per FEN upstream). */
  corpusStatus: CorpusBookStatus;
  /** Play the move for the room (a real, broadcast op) — editors only. */
  onPlayMove?: (move: LegalMove) => void;
  /** Preview the move as a ghost arrow while hovered (local, everyone). */
  onHoverMove: (move: LegalMove | null) => void;
}) {
  const { t } = useTranslation();
  const named = useMemo(() => (book === null ? [] : continuationsFor(book, fen)), [book, fen]);
  // The merged corpus rows are the row source and the named-row stat
  // decoration at once — one normalization pass serves both.
  const merged = useMemo(
    () => (corpusStatus.kind === 'ready' ? mergeCorpusMoves(corpusStatus.moves) : []),
    [corpusStatus],
  );
  const corpusRows = useMemo(
    () => (merged.length > 0 ? corpusContinuationsFor(book, fen, merged) : []),
    [book, fen, merged],
  );
  const statsByName = useMemo(() => new Map(merged.map((row) => [row.move, row])), [merged]);
  // The position's own opening name: the panel names where you are, not
  // just where you could go — a transposition's destination reads as its
  // book line, not a bare "no named continuations".
  const positionOpening = openingAt(book, fen);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="reference-panel">
      {positionOpening !== null && (
        <p className="m-0 px-3 pt-2 text-micro text-faint" data-testid="reference-position-name">
          {positionOpening.eco} · {positionOpening.name}
        </p>
      )}
      {corpusRows.length === 0 && named.length === 0 ? (
        // No rows to show — but the corpus verdict may still be in flight:
        // its rows lead when they arrive, so don't declare "nothing here"
        // early.
        corpusStatus.kind === 'loading' ? (
          <p
            className="m-0 flex items-center gap-1.5 p-3 text-micro text-muted"
            data-testid="reference-stats-loading"
            role="status"
          >
            <span className={statusDot({ tone: 'warn', pulse: true })} />
            {t('analysis.referenceStatsLoading')}
          </p>
        ) : (
          <>
            {corpusStatus.kind === 'failed' && (
              <p
                className="m-0 flex items-center gap-1.5 px-3 pt-2 text-micro text-bad-hi"
                data-testid="reference-stats-failed"
                role="alert"
              >
                {t('analysis.referenceStatsFailed')}
              </p>
            )}
            <p className="m-0 p-3 text-note text-faint">{t('analysis.referenceEmpty')}</p>
          </>
        )
      ) : (
        <>
          {corpusStatus.kind === 'loading' && (
            <p
              className="m-0 flex items-center gap-1.5 px-3 pt-2 text-micro text-muted"
              data-testid="reference-stats-loading"
              role="status"
            >
              <span className={statusDot({ tone: 'warn', pulse: true })} />
              {t('analysis.referenceStatsLoading')}
            </p>
          )}
          {corpusStatus.kind === 'failed' && (
            <p
              className="m-0 flex items-center gap-1.5 px-3 pt-2 text-micro text-bad-hi"
              data-testid="reference-stats-failed"
              role="alert"
            >
              {t('analysis.referenceStatsFailed')}
            </p>
          )}
          <ul
            className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1"
            data-testid="reference-list"
          >
            {corpusRows.length > 0
              ? corpusRows.map((row) => (
                  // Hover handlers sit on the li: disabled buttons (viewers)
                  // don't fire mouse events, but the ghost preview is for
                  // everyone.
                  <li
                    key={row.san}
                    onMouseEnter={() => onHoverMove(row)}
                    onMouseLeave={() => onHoverMove(null)}
                  >
                    <button
                      type="button"
                      className="flex w-full flex-col rounded-control px-2 py-1.5 text-left transition-colors not-disabled:hover:bg-raised disabled:cursor-default"
                      disabled={onPlayMove === undefined}
                      onClick={() => onPlayMove?.(row)}
                    >
                      <span className="flex w-full items-baseline gap-2">
                        <span className="shrink-0 text-ui font-semibold text-ink tabular-nums">
                          {row.san}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-right text-note text-muted">
                          {row.opening !== null ? `${row.opening.eco} · ${row.opening.name}` : ''}
                        </span>
                        <span className="shrink-0 font-mono text-micro text-faint tabular-nums">
                          {row.stats.games.toLocaleString('en-US').replace(/,/g, ' ')}
                        </span>
                      </span>
                      <RateBar stats={row.stats} />
                    </button>
                  </li>
                ))
              : named.map((continuation) => {
                  const stat = statsByName.get(continuation.san) ?? null;
                  return (
                    <li
                      key={continuation.san}
                      onMouseEnter={() => onHoverMove(continuation)}
                      onMouseLeave={() => onHoverMove(null)}
                    >
                      <button
                        type="button"
                        className="flex w-full flex-col rounded-control px-2 py-1.5 text-left transition-colors not-disabled:hover:bg-raised disabled:cursor-default"
                        disabled={onPlayMove === undefined}
                        onClick={() => onPlayMove?.(continuation)}
                      >
                        <span className="flex w-full items-baseline gap-2">
                          <span className="shrink-0 text-ui font-semibold text-ink tabular-nums">
                            {continuation.san}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-right text-note text-muted">
                            {continuation.eco} · {continuation.name}
                          </span>
                          {stat !== null && (
                            <span className="shrink-0 font-mono text-micro text-faint tabular-nums">
                              {stat.games.toLocaleString('en-US').replace(/,/g, ' ')}
                            </span>
                          )}
                        </span>
                        {stat !== null && <RateBar stats={stat} />}
                        {corpusStatus.kind === 'loading' && (
                          <span
                            className="mt-1 block h-2 animate-pulse rounded-[3px] border border-line bg-raised/60"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
          </ul>
        </>
      )}
    </div>
  );
}
