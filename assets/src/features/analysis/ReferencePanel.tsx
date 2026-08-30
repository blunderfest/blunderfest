import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statusDot } from '@/components/ui';
import { continuationsFor, type OpeningBook } from '@/features/analysis/openings';
import { type BookMove, fetchBook, type LegalMove } from '@/lib/api';

/**
 * The Reference tab (ADR-0024, corpus stats per the phase-aware book):
 * per-position reference data following the board cursor. The named book
 * continuations, each with its corpus game count and a W/D/B rate bar —
 * "what was played here, and how it went." Rows without corpus data keep
 * their plain eco/name shape (no bar).
 *
 * Rows are a third way to play a move (alongside the board and the move
 * list): hovering previews the move as a translucent ghost arrow on the
 * board (local, never broadcast); clicking plays it as a real op for the
 * whole room — broadcast is the collaborative point (ADR-0024, revised).
 * Viewers preview but cannot play.
 */

/** The per-fen stats cache — module-scoped, so cursor moves back are free. */
const statsCache = new Map<string, Map<string, BookMove>>();

/** Test seam: drop the cached stats. */
export function resetBookStatsCache(): void {
  statsCache.clear();
}

/** The book-stats fetch state for the rendered position. */
type StatsStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; stats: Map<string, BookMove> }
  | { kind: 'failed' };

function useBookStats(fen: string | null): StatsStatus {
  const [status, setStatus] = useState<StatsStatus>(() => {
    if (fen === null) {
      return { kind: 'ready', stats: new Map() };
    }
    const cached = statsCache.get(fen);
    return cached !== undefined ? { kind: 'ready', stats: cached } : { kind: 'loading' };
  });

  // A position change resets to loading unless the stats are cached —
  // render-time compare (adjust-state-during-render) avoids an effect round.
  const [previousFen, setPreviousFen] = useState<string | null>(fen);
  if (previousFen !== fen) {
    setPreviousFen(fen);
    if (fen === null) {
      setStatus({ kind: 'ready', stats: new Map() });
    } else {
      const cached = statsCache.get(fen);
      setStatus(cached !== undefined ? { kind: 'ready', stats: cached } : { kind: 'loading' });
    }
  }

  useEffect(() => {
    if (fen === null) {
      return;
    }
    if (statsCache.get(fen) !== undefined) {
      return;
    }
    let cancelled = false;
    fetchBook(fen)
      .then(({ moves }) => {
        if (!cancelled) {
          const map = new Map(moves.map((m) => [m.move, m]));
          statsCache.set(fen, map);
          setStatus({ kind: 'ready', stats: map });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ kind: 'failed' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fen]);

  return status;
}

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
  const status = useBookStats(fen);
  const stats = status.kind === 'ready' ? status.stats : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="reference-panel">
      {continuations.length === 0 ? (
        <p className="m-0 p-3 text-note text-faint">{t('analysis.referenceEmpty')}</p>
      ) : (
        <>
          {status.kind === 'loading' && (
            <p
              className="m-0 flex items-center gap-1.5 px-3 pt-2 text-micro text-muted"
              data-testid="reference-stats-loading"
              role="status"
            >
              <span className={statusDot({ tone: 'warn', pulse: true })} />
              {t('analysis.referenceStatsLoading')}
            </p>
          )}
          {status.kind === 'failed' && (
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
            {continuations.map((continuation) => {
              const stat = stats?.get(continuation.san) ?? null;
              return (
                // Hover handlers sit on the li: disabled buttons (viewers) don't
                // fire mouse events, but the ghost preview is for everyone.
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
                    {status.kind === 'loading' && (
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
