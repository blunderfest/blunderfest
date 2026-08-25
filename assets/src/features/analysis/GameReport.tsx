import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { bestMoveSans, evalText, type MoveMark } from '@/features/analysis/evalMarks';
import { plyLabel } from '@/features/analysis/GameFlow';
import { gameReport, type SideStats } from '@/features/analysis/gameReport';
import type { Opening } from '@/features/analysis/openings';
import type { GameTree } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

const MARK_COLOR: Record<MoveMark, string> = {
  '??': 'text-bad-hi',
  '?': 'text-gold-hi',
  '?!': 'text-muted',
};

/**
 * The "learn from this game" report (viz box, Report tab): an accuracy card
 * per side with its mark counts, then every marked move in play order with
 * the eval swing and the engine's best alternative — click one to jump to
 * the position. Derived from the completed whole-game analysis; pure
 * presentation, all the math lives in `gameReport.ts`.
 */
export default function GameReport({
  tree,
  evals,
  opening = null,
  onSelectPly,
}: {
  tree: GameTree;
  evals: AnalysisEval[];
  /** The game's (mainline) opening, once the book has loaded. */
  opening?: Opening | null;
  onSelectPly: (ply: number) => void;
}) {
  const { t } = useTranslation();
  const report = useMemo(() => gameReport(tree.root, evals), [tree, evals]);
  const bestSans = useMemo(() => bestMoveSans(tree.root, evals), [tree, evals]);
  const names: Record<'white' | 'black', string> = {
    white: tree.headers.White || t('analysis.sideWhite'),
    black: tree.headers.Black || t('analysis.sideBlack'),
  };

  function sideLabel(side: 'white' | 'black', stats: SideStats): string {
    const accuracy =
      stats.accuracy === null
        ? '–'
        : t('analysis.reportAccuracy', { value: stats.accuracy.toFixed(1) });
    return `${names[side]}: ${accuracy}, ${t('analysis.reportBlunders', { count: stats.blunders })}, ${t('analysis.reportMistakes', { count: stats.mistakes })}, ${t('analysis.reportInaccuracies', { count: stats.inaccuracies })}`;
  }

  /** "1-0 · C57 · Two Knights Defense" — whatever of it exists. */
  const header = [
    tree.result !== '*' ? tree.result : null,
    opening !== null ? opening.eco : null,
    opening?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-2" data-testid="game-report">
      {header !== '' && (
        <p className="m-0 truncate px-1 text-note text-muted" data-testid="game-report-header">
          {header}
        </p>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {(['white', 'black'] as const).map((side) => {
          const stats = report[side];
          return (
            <div key={side} className="rounded-control border border-line bg-surface px-2 py-1.5">
              {/*
                The full sentence for screen readers (pluralized words); the
                visible glyph row below would read as punctuation soup.
              */}
              <span className="sr-only">{sideLabel(side, stats)}</span>
              <div aria-hidden="true">
                <div className="truncate text-note font-semibold text-ink">{names[side]}</div>
                <div className="text-lead font-bold tabular-nums text-gold-hi">
                  {stats.accuracy === null ? '–' : `${stats.accuracy.toFixed(1)}%`}
                </div>
                <div className="text-micro text-faint tabular-nums">
                  ?? {stats.blunders} · ? {stats.mistakes} · ?! {stats.inaccuracies}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {report.marked.length === 0 ? (
        <p className="m-0 p-1 text-note text-faint">
          {evals.length === 0 ? t('analysis.noAnalysisHint') : t('analysis.noMoments')}
        </p>
      ) : (
        <ul className="m-0 flex flex-col" data-testid="game-report-moves">
          {report.marked.map((move) => (
            <li key={move.ply}>
              <button
                type="button"
                data-testid={`game-report-move-${move.ply}`}
                className="flex w-full items-baseline gap-2 rounded-control px-2 py-1 text-left text-note transition-colors hover:bg-raised"
                onClick={() => onSelectPly(move.ply)}
              >
                <span className="shrink-0 font-semibold text-ink tabular-nums">
                  {plyLabel(move.ply, '')} {move.san}
                  <span className={MARK_COLOR[move.mark]}>{move.mark}</span>
                </span>
                <span className="shrink-0 text-faint tabular-nums">
                  {evalText(move.before)} → {evalText(move.after)}
                </span>
                {bestSans.has(move.ply) && (
                  <span className="min-w-0 flex-1 truncate text-right text-muted">
                    {t('analysis.bestMove', { move: bestSans.get(move.ply) })}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
