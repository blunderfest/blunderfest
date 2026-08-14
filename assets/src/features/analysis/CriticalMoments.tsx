import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { chip } from '@/components/ui';
import { evalText, type MoveMark, moveMark, toCentipawns } from '@/features/analysis/evalMarks';
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
        moments.push({ ply: node.ply, san: node.san, mark, before, after, loss });
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
 * The "story of the game": the five biggest swings as clickable chips that
 * jump straight to the position. Lives in the visualization box; needs a
 * completed analysis.
 */
export default function CriticalMoments({
  tree,
  evals,
  onSelectPly,
}: {
  tree: GameTree;
  evals: AnalysisEval[];
  onSelectPly: (ply: number) => void;
}) {
  const { t } = useTranslation();
  const moments = useMemo(() => criticalMoments(tree.root, evals), [tree, evals]);

  return (
    <div
      className="flex h-20 flex-wrap content-center items-center gap-1.5 overflow-y-auto p-1"
      data-testid="critical-moments"
    >
      {moments.length === 0 ? (
        <p className="m-0 w-full text-center text-note text-faint">{t('analysis.noMoments')}</p>
      ) : (
        moments.map((moment) => (
          <button
            key={moment.ply}
            type="button"
            className={chip({
              tone: moment.mark === '??' ? 'bad' : moment.mark === '?' ? 'gold' : 'neutral',
              // SANs stay as written — the chip's default uppercase butchers them.
              class:
                'cursor-pointer normal-case tracking-normal transition-opacity hover:opacity-75',
            })}
            title={`${evalText(moment.before)} → ${evalText(moment.after)}`}
            data-testid="critical-moment"
            onClick={() => onSelectPly(moment.ply)}
          >
            {plyLabel(moment.ply, '')} {moment.san}
            {moment.mark}
          </button>
        ))
      )}
    </div>
  );
}
