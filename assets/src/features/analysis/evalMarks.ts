import { pvToSan, type WhiteEval } from '@/features/analysis/uci';
import type { GameNode } from '@/lib/api';
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
  if (score.result !== undefined) {
    return score.result === '1-0' ? 10_000 : score.result === '0-1' ? -10_000 : 0;
  }
  if (score.cp !== undefined) {
    return score.cp;
  }
  if (score.mate !== undefined) {
    return score.mate > 0 ? 10_000 : -10_000;
  }
  return null;
}

/** The live-engine counterpart of toCentipawns: a WhiteEval in centipawns. */
export function whiteEvalToCp(white: WhiteEval): number {
  if (white.type === 'result') {
    return white.result === '1-0' ? 10_000 : white.result === '0-1' ? -10_000 : 0;
  }
  if (white.type === 'mate') {
    return white.moves > 0 ? 10_000 : -10_000;
  }
  return white.cp;
}

/**
 * The shared mark thresholds (75/150/300 cp), so drag flags, move-list
 * marks, chart dots and the report never disagree.
 */
export function markForLoss(lossCp: number): MoveMark | null {
  if (lossCp >= 300) {
    return '??';
  }
  if (lossCp >= 150) {
    return '?';
  }
  if (lossCp >= 75) {
    return '?!';
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
  return markForLoss(loss);
}

/** "+0.4", "-1.2", "M3", "1-0" — white's perspective. */
export function evalText(score: AnalysisEval['score']): string {
  if (score === null) {
    return '–';
  }
  if (score.result !== undefined) {
    return score.result;
  }
  if (score.mate !== undefined) {
    return score.mate > 0 ? `M${score.mate}` : `-M${-score.mate}`;
  }
  const cp = score.cp ?? 0;
  const value = (cp / 100).toFixed(1);
  return cp > 0 ? `+${value}` : value;
}

/**
 * The engine's best move before each mainline move, as SAN, keyed by the
 * move's ply: the stored `best_move` at ply N is the recommendation for the
 * position of ply N — the alternative to whatever was played at ply N + 1.
 */
export function bestMoveSans(root: GameNode, evals: AnalysisEval[]): Map<number, string> {
  const byPly = new Map(evals.map((evaluation) => [evaluation.ply, evaluation]));
  const map = new Map<number, string>();
  let node: GameNode | null = root;
  while (node !== null) {
    const child = node.children[0];
    const best = byPly.get(node.ply)?.best_move ?? null;
    if (child !== undefined && best !== null && node.fen !== null) {
      const san = pvToSan(node.fen, [best])[0];
      if (san !== undefined) {
        map.set(child.ply, san);
      }
    }
    node = node.children[0] ?? null;
  }
  return map;
}
