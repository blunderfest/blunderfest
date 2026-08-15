import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Board from '@/components/Board';
import { parseFen } from '@/components/board';
import {
  bestMoveSans,
  evalText,
  type MoveMark,
  moveMark,
  toCentipawns,
} from '@/features/analysis/evalMarks';
import { plyLabel } from '@/features/analysis/GameFlow';
import type { GameNode, GameTree } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

export type Moment = {
  ply: number;
  san: string;
  mark: MoveMark;
  before: AnalysisEval['score'];
  after: AnalysisEval['score'];
  /** Centipawns lost for the mover (always positive). */
  loss: number;
  /** The position after the move (for the mini board), and the move itself. */
  fen: string | null;
  from: string | null;
  to: string | null;
};

/**
 * The moves that decided the game: every marked move (?! and worse) by eval
 * swing, the five biggest, in play order. Derived from the whole-game
 * analysis — the same loss math as the move-list marks.
 */
export function criticalMoments(root: GameNode, evals: AnalysisEval[]): Moment[] {
  const byPly = new Map(evals.map((evaluation) => [evaluation.ply, evaluation.score]));
  const moments: Moment[] = [];
  let node: GameNode | null = root.children[0] ?? null;
  while (node !== null) {
    if (node.san !== null) {
      const before = byPly.get(node.ply - 1) ?? null;
      const after = byPly.get(node.ply) ?? null;
      const mark = moveMark(before, after, node.ply % 2 === 1);
      const beforeCp = toCentipawns(before);
      const afterCp = toCentipawns(after);
      if (mark !== null && beforeCp !== null && afterCp !== null) {
        const loss = node.ply % 2 === 1 ? beforeCp - afterCp : afterCp - beforeCp;
        moments.push({
          ply: node.ply,
          san: node.san,
          mark,
          before,
          after,
          loss,
          fen: node.fen,
          from: node.from,
          to: node.to,
        });
      }
    }
    node = node.children[0] ?? null;
  }
  return moments
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 5)
    .sort((a, b) => a.ply - b.ply);
}

/**
 * The "story of the game": the five biggest swings as mini boards — the
 * position right after the move, with the move highlighted. Clicking one
 * jumps straight to that ply. Lives in the sidebar's Moments tab; needs a
 * completed analysis.
 */
export default function CriticalMoments({
  tree,
  evals,
  flipped = false,
  onSelectPly,
}: {
  tree: GameTree;
  evals: AnalysisEval[];
  flipped?: boolean;
  onSelectPly: (ply: number) => void;
}) {
  const { t } = useTranslation();
  const moments = useMemo(() => criticalMoments(tree.root, evals), [tree, evals]);
  const bestSans = useMemo(() => bestMoveSans(tree.root, evals), [tree, evals]);

  if (moments.length === 0) {
    return (
      <div className="grid flex-1 place-items-center p-4">
        <p className="m-0 text-note text-faint">{t('analysis.noMoments')}</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2"
      data-testid="critical-moments"
    >
      {moments.map((moment) => (
        <button
          key={moment.ply}
          type="button"
          className="flex items-center gap-3 rounded-control p-2 text-left transition-colors hover:bg-raised"
          data-testid="critical-moment"
          onClick={() => onSelectPly(moment.ply)}
        >
          {moment.fen !== null && (
            <Board
              position={parseFen(moment.fen)}
              lastMove={
                moment.from !== null && moment.to !== null
                  ? { from: moment.from, to: moment.to }
                  : null
              }
              flipped={flipped}
              width={88}
              label={t('analysis.momentBoard', {
                move: `${plyLabel(moment.ply, '')} ${moment.san}`,
              })}
            />
          )}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-ui font-semibold text-ink">
              {plyLabel(moment.ply, '')} {moment.san}
              <span
                className={
                  moment.mark === '??'
                    ? 'text-bad-hi'
                    : moment.mark === '?'
                      ? 'text-gold-hi'
                      : 'text-muted'
                }
              >
                {moment.mark}
              </span>
            </span>
            <span className="text-note text-faint tabular-nums">
              {evalText(moment.before)} → {evalText(moment.after)}
            </span>
            {bestSans.has(moment.ply) && (
              <span className="text-note text-muted">
                {t('analysis.bestMove', { move: bestSans.get(moment.ply) })}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
