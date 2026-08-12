import type { AnalysisEval } from '@/protocol/ops';

/**
 * Move-quality marks from a completed whole-game analysis (ADR-0009): how
 * much the eval dropped for the mover, in white-perspective centipawns.
 * Mate scores count as ±10 pawns.
 */
export type MoveMark = '??' | '?' | '?!';

export function toCentipawns(score: AnalysisEval['score']): number | null {
  if (score === null) {
    return null;
  }
  if (score.cp !== undefined) {
    return score.cp;
  }
  if (score.mate !== undefined) {
    return score.mate > 0 ? 10_000 : -10_000;
  }
  return null;
}

export function moveMark(
  before: AnalysisEval['score'],
  after: AnalysisEval['score'],
  moverIsWhite: boolean,
): MoveMark | null {
  const beforeCp = toCentipawns(before);
  const afterCp = toCentipawns(after);
  if (beforeCp === null || afterCp === null) {
    return null;
  }
  const loss = moverIsWhite ? beforeCp - afterCp : afterCp - beforeCp;
  if (loss >= 300) {
    return '??';
  }
  if (loss >= 150) {
    return '?';
  }
  if (loss >= 75) {
    return '?!';
  }
  return null;
}

/** "+0.4", "-1.2", "M3", "-M2" — white's perspective. */
export function evalText(score: AnalysisEval['score']): string {
  if (score === null) {
    return '–';
  }
  if (score.mate !== undefined) {
    return score.mate > 0 ? `M${score.mate}` : `-M${-score.mate}`;
  }
  const cp = score.cp ?? 0;
  const value = (cp / 100).toFixed(1);
  return cp > 0 ? `+${value}` : value;
}
