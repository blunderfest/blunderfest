import { describe, expect, it } from 'vitest';
import { activityTimeline } from '@/features/analysis/activity';
import type { GameNode } from '@/lib/api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
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
    fen: START_FEN,
    children: [],
    ...partial,
  };
}

describe('activityTimeline', () => {
  it('counts 20 legal moves per side in the start position', () => {
    expect(activityTimeline(node({}))).toEqual([{ ply: 0, white: 20, black: 20 }]);
  });

  it('tracks both sides after a move (the mover opens lines)', () => {
    const root = node({
      children: [node({ id: 1, ply: 1, san: 'e4', fen: AFTER_E4 })],
    });

    const points = activityTimeline(root);
    expect(points).toHaveLength(2);
    expect(points[1].ply).toBe(1);
    // Black to move after e4: still 20; white (turn-flipped) has more.
    expect(points[1].black).toBe(20);
    expect(points[1].white).toBeGreaterThan(20);
  });
});
