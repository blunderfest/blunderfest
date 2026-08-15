import { describe, expect, it } from 'vitest';
import { bestMoveSans, evalText, moveMark, toCentipawns } from '@/features/analysis/evalMarks';
import type { GameNode } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

describe('toCentipawns', () => {
  it('maps results to terminal values', () => {
    expect(toCentipawns({ result: '1-0' })).toBe(10_000);
    expect(toCentipawns({ result: '0-1' })).toBe(-10_000);
    expect(toCentipawns({ result: '1/2-1/2' })).toBe(0);
  });
});

describe('evalText', () => {
  it('renders the result for terminal positions', () => {
    expect(evalText({ result: '1-0' })).toBe('1-0');
    expect(evalText({ result: '0-1' })).toBe('0-1');
  });
});

describe('moveMark', () => {
  it('never flags the mating move as a blunder', () => {
    // White plays Qg7#: mate-in-1 before, the stored result after.
    expect(moveMark({ mate: 1 }, { result: '1-0' }, true)).toBeNull();
    // Black delivers fool's mate: mate-for-black before, 0-1 after.
    expect(moveMark({ mate: -1 }, { result: '0-1' }, false)).toBeNull();
  });

  it('still flags a blunder that throws away a forced mate', () => {
    // White had mate in 1 and played a quiet move instead (+0.2).
    expect(moveMark({ mate: 1 }, { cp: 20 }, true)).toBe('??');
  });
});

describe('bestMoveSans', () => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

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

  const root = node({
    id: 0,
    san: null,
    children: [
      node({
        id: 1,
        ply: 1,
        san: 'e4',
        fen: AFTER_E4,
        children: [
          node({
            id: 2,
            ply: 2,
            san: 'e5',
            fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
          }),
        ],
      }),
    ],
  });

  const evals: AnalysisEval[] = [
    { ply: 0, score: { cp: 20 }, best_move: 'g1f3' },
    { ply: 1, score: { cp: 30 }, best_move: 'e7e5' },
  ];

  it('maps the engine best move to SAN, keyed by the move it was the alternative to', () => {
    const map = bestMoveSans(root, evals);
    expect(map.get(1)).toBe('Nf3');
    expect(map.get(2)).toBe('e5');
  });

  it('skips positions without a best move', () => {
    const sparse: AnalysisEval[] = [{ ply: 0, score: { cp: 20 }, best_move: null }];
    expect(bestMoveSans(root, sparse).size).toBe(0);
  });
});
