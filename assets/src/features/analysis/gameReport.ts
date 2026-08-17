import { type MoveMark, moveMark, toCentipawns } from '@/features/analysis/evalMarks';
import { type WhiteEval, winShare } from '@/features/analysis/uci';
import type { GameNode } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

/**
 * The data behind the viz box's Report tab ("learn from this game"),
 * derived from a completed whole-game analysis (ADR-0009): per-side
 * accuracy and mark counts, plus every marked move in play order for
 * review. Mark thresholds are exactly the move list's (`moveMark`), so the
 * report never disagrees with the glyphs in the list.
 *
 * Accuracy follows lichess's per-move curve over the mover's win-share
 * loss, averaged over the side's moves. An approximation by design: no
 * volatility weighting, no book-move exclusion.
 */

export type SideStats = {
  /** Moves with evals on both sides (the accuracy sample size). */
  moves: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  /** 0–100; null when the side has no evaluable moves. */
  accuracy: number | null;
};

export type ReportMove = {
  ply: number;
  san: string;
  mark: MoveMark;
  before: AnalysisEval['score'];
  after: AnalysisEval['score'];
  /** Centipawns lost for the mover (always positive). */
  loss: number;
};

export type GameReportData = {
  white: SideStats;
  black: SideStats;
  /** Every marked move (?! and worse) in play order. */
  marked: ReportMove[];
};

function toWhiteEval(score: AnalysisEval['score']): WhiteEval | null {
  if (score === null) {
    return null;
  }
  if (score.result !== undefined) {
    return { type: 'result', result: score.result };
  }
  if (score.cp !== undefined) {
    return { type: 'cp', cp: score.cp };
  }
  if (score.mate !== undefined) {
    return { type: 'mate', moves: score.mate };
  }
  return null;
}

/** White's win share for a stored score; null when there is no eval. */
function shareOf(score: AnalysisEval['score']): number | null {
  const white = toWhiteEval(score);
  return white === null ? null : winShare(white);
}

/**
 * Lichess's per-move accuracy curve: win-share points lost → 0..100. A
 * move that loses nothing scores 100; the curve decays exponentially, so a
 * 10-point loss still scores ~68 and a blunder (~30 points) lands near 24.
 */
export function moveAccuracy(lossShare: number): number {
  return Math.min(100, Math.max(0, 103.1668 * Math.exp(-0.04354 * lossShare) - 3.1669));
}

function emptyStats(): SideStats {
  return { moves: 0, inaccuracies: 0, mistakes: 0, blunders: 0, accuracy: null };
}

export function gameReport(root: GameNode, evals: AnalysisEval[]): GameReportData {
  const byPly = new Map(evals.map((evaluation) => [evaluation.ply, evaluation.score]));
  const white = emptyStats();
  const black = emptyStats();
  let whiteAccuracy = 0;
  let blackAccuracy = 0;
  const marked: ReportMove[] = [];

  let node: GameNode | null = root.children[0] ?? null;
  while (node !== null) {
    if (node.san !== null) {
      const moverIsWhite = node.ply % 2 === 1;
      const before = byPly.get(node.ply - 1) ?? null;
      const after = byPly.get(node.ply) ?? null;
      const beforeShare = shareOf(before);
      const afterShare = shareOf(after);

      if (beforeShare !== null && afterShare !== null) {
        const stats = moverIsWhite ? white : black;
        const moverBefore = moverIsWhite ? beforeShare : 100 - beforeShare;
        const moverAfter = moverIsWhite ? afterShare : 100 - afterShare;
        const lossShare = Math.max(0, moverBefore - moverAfter);
        stats.moves += 1;
        if (moverIsWhite) {
          whiteAccuracy += moveAccuracy(lossShare);
        } else {
          blackAccuracy += moveAccuracy(lossShare);
        }

        const mark = moveMark(before, after, moverIsWhite);
        const beforeCp = toCentipawns(before);
        const afterCp = toCentipawns(after);
        if (mark !== null && beforeCp !== null && afterCp !== null) {
          const loss = moverIsWhite ? beforeCp - afterCp : afterCp - beforeCp;
          marked.push({ ply: node.ply, san: node.san, mark, before, after, loss });
          if (mark === '??') {
            stats.blunders += 1;
          } else if (mark === '?') {
            stats.mistakes += 1;
          } else {
            stats.inaccuracies += 1;
          }
        }
      }
    }
    node = node.children[0] ?? null;
  }

  white.accuracy = white.moves > 0 ? whiteAccuracy / white.moves : null;
  black.accuracy = black.moves > 0 ? blackAccuracy / black.moves : null;

  return { white, black, marked };
}
