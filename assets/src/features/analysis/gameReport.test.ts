import { describe, expect, it } from 'vitest';
import { gameReport, moveAccuracy } from '@/features/analysis/gameReport';
import type { GameNode } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function node(partial: Partial<GameNode>): GameNode {
  return {
    id: 0,
    ply: 0,
    san: '',
    from: null,
    to: null,
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    fen: START,
    children: [],
    ...partial,
  };
}

/** A mainline chain from SANs: node({ san: 'e4', children: [node({ san: 'e5' })] }). */
function line(sans: string[]): GameNode {
  const root = node({ id: 0, ply: 0, san: null });
  let tip = root;
  for (const [index, san] of sans.entries()) {
    const child = node({ id: index + 1, ply: index + 1, san });
    tip.children = [child];
    tip = child;
  }
  return root;
}

/** Even-ply-indexed evals: eval per ply 0..plyCount, by a [cp, cp] pair list. */
function evalsOf(cps: (number | null)[]): AnalysisEval[] {
  return cps.map((cp, ply) => ({
    ply,
    score: cp === null ? null : { cp },
    best_move: null,
  }));
}

describe('moveAccuracy', () => {
  it('scores ~100 for no loss and decays exponentially', () => {
    // The curve's zero-loss value is 99.9999 — displays as 100.0%.
    expect(moveAccuracy(0)).toBeCloseTo(100, 3);
    // Roughly lichess's curve: 10 win-share points lost ≈ 68, 30 ≈ 28.
    expect(moveAccuracy(10)).toBeGreaterThan(60);
    expect(moveAccuracy(10)).toBeLessThan(75);
    expect(moveAccuracy(30)).toBeGreaterThan(20);
    expect(moveAccuracy(30)).toBeLessThan(35);
    expect(moveAccuracy(100)).toBe(0); // huge losses hit the clamped floor
  });
});

describe('gameReport', () => {
  it('reports a clean game at 100% accuracy with no marked moves', () => {
    const root = line(['e4', 'e5', 'Nf3']);
    const evals = evalsOf([20, 25, 22, 30]);

    const report = gameReport(root, evals);

    expect(report.marked).toEqual([]);
    expect(report.white.moves).toBe(2);
    expect(report.black.moves).toBe(1);
    expect(report.white.accuracy).toBeCloseTo(100, 3);
    expect(report.black.accuracy).toBeCloseTo(100, 3);
    expect(report.white.blunders).toBe(0);
  });

  it('counts marks per side and keeps them in play order', () => {
    // 1. e4 (fine) 1...e5?? (blunder: +20 → +400 for white, black loses ~380cp)
    // 2. Nf3? (mistake: +400 → +200 for white) 2...Nc6 (fine)
    const root = line(['e4', 'e5', 'Nf3', 'Nc6']);
    const evals = evalsOf([20, 20, 400, 200, 210]);

    const report = gameReport(root, evals);

    expect(report.marked.map((m) => [m.ply, m.mark])).toEqual([
      [2, '??'],
      [3, '?'],
    ]);
    expect(report.black.blunders).toBe(1);
    expect(report.white.mistakes).toBe(1);
    expect(report.white.blunders).toBe(0);
    // The blunder costs black dearly; white's mistake halves a big plus.
    expect(report.black.accuracy ?? 100).toBeLessThan(report.white.accuracy ?? 0);
  });

  it('attributes improvements correctly for black (eval sign flip)', () => {
    // 1. e4 e5 2. Nf3?? — white blunders away a small plus into a lost game.
    const root = line(['e4', 'e5', 'Nf3']);
    const evals = evalsOf([20, 20, 20, -350]);

    const report = gameReport(root, evals);

    expect(report.marked).toHaveLength(1);
    expect(report.marked[0].ply).toBe(3);
    expect(report.marked[0].mark).toBe('??');
    expect(report.white.blunders).toBe(1);
    expect(report.black.blunders).toBe(0);
    expect(report.black.accuracy).toBeCloseTo(100, 3);
  });

  it('skips moves without evals on both sides instead of punishing the player', () => {
    const root = line(['e4', 'e5', 'Nf3']);
    // Ply 1 has no eval: e4 and e5 can't be scored, Nf3 can.
    const evals = evalsOf([20, null, 25, 30]);

    const report = gameReport(root, evals);

    expect(report.white.moves).toBe(1);
    expect(report.black.moves).toBe(0);
    expect(report.black.accuracy).toBeNull();
    expect(report.marked).toEqual([]);
  });

  it('handles terminal results (mate) without flagging the winner', () => {
    // White mates: +M1 before, 1-0 after. Result scores map to terminal shares.
    const root = line(['Qg7']);
    const evals: AnalysisEval[] = [
      { ply: 0, score: { mate: 1 }, best_move: null },
      { ply: 1, score: { result: '1-0' }, best_move: null },
    ];

    const report = gameReport(root, evals);

    expect(report.marked).toEqual([]);
    expect(report.white.moves).toBe(1);
    expect(report.white.accuracy).toBeCloseTo(100, 3);
  });

  it('returns null accuracies for an empty game', () => {
    const report = gameReport(node({ id: 0, san: null }), []);

    expect(report.white.accuracy).toBeNull();
    expect(report.black.accuracy).toBeNull();
    expect(report.marked).toEqual([]);
  });
});
