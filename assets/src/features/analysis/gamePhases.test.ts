import { describe, expect, it } from 'vitest';
import { endgameStart } from '@/features/analysis/gamePhases';
import type { GameNode } from '@/lib/api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** Both queens off, everything else home: the queen rule fires, material (22) doesn't. */
const QUEENS_OFF_FEN = 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1';
/** Queens on, but both sides down to queen + minor (12): the material rule fires. */
const LIGHT_MATERIAL_FEN = '3q1n1k/8/8/8/8/8/8/3Q1N1K w - - 0 1';
/** Queens on, one side still heavy (19): neither rule fires. */
const HEAVY_FEN = 'r2q1rk1/pppppppp/8/8/8/8/PPPPPPPP/R2Q1RK1 w - - 0 1';

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

/** A mainline from FENs: ply i carries fens[i]. */
function line(fens: string[]): GameNode {
  const root = node({ id: 0, ply: 0, fen: fens[0] });
  let current = root;
  for (let ply = 1; ply < fens.length; ply++) {
    const next = node({ id: ply, ply, fen: fens[ply] });
    current.children = [next];
    current = next;
  }
  return root;
}

describe('endgameStart', () => {
  it('reports no endgame while queens and material stay middlegame-sized', () => {
    expect(endgameStart(line([START_FEN, HEAVY_FEN, HEAVY_FEN]))).toBeNull();
  });

  it('starts at the ply the last queen leaves the board', () => {
    expect(endgameStart(line([START_FEN, HEAVY_FEN, QUEENS_OFF_FEN]))).toBe(2);
  });

  it('starts when both sides drop to light material, queens still on', () => {
    expect(endgameStart(line([START_FEN, LIGHT_MATERIAL_FEN]))).toBe(1);
  });

  it('returns 0 for a game that starts as an endgame', () => {
    expect(endgameStart(line([LIGHT_MATERIAL_FEN, LIGHT_MATERIAL_FEN]))).toBe(0);
  });

  it('ignores a mid-game dip when material comes back (promotion)', () => {
    // Ply 1 is queenless (endgame), ply 2 brings a queen back with heavy support.
    const recovered = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R2QK2R b KQkq - 0 1';
    expect(endgameStart(line([START_FEN, QUEENS_OFF_FEN, recovered]))).toBeNull();
  });

  it('skips nodes without FENs instead of breaking the walk', () => {
    const root = node({
      children: [
        node({
          id: 1,
          ply: 1,
          fen: null,
          children: [node({ id: 2, ply: 2, fen: QUEENS_OFF_FEN })],
        }),
      ],
    });
    expect(endgameStart(root)).toBe(2);
  });
});
