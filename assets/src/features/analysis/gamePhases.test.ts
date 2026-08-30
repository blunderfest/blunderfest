import { describe, expect, it } from 'vitest';
import { endgameStart } from '@/features/analysis/gamePhases';
import type { GameNode } from '@/lib/api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** Both queens off, everything else home: NOT an endgame (a queen trade alone is a middlegame). */
const QUEENS_OFF_FEN = 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1';
/** Queens on, but both sides down to queen + minor (12): the material rule fires. */
const LIGHT_MATERIAL_FEN = '3q1n1k/8/8/8/8/8/8/3Q1N1K w - - 0 1';
/** Queens on, one side still heavy (19): neither rule fires. */
const HEAVY_FEN = 'r2q1rk1/pppppppp/8/8/8/8/PPPPPPPP/R2Q1RK1 w - - 0 1';
/** 1. e4 c6 2. Nf3 d5 3. d3 dxe4 4. dxe4 Qxd1+ 5. Kxd1 — queens off, full board otherwise. */
const KXD1_FEN = 'rnb1kbnr/ppp1pppp/8/8/8/8/PPPK1PPP/RNBQ1BNR b - - 0 5';

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

  it('a queen trade alone is not an endgame (full board otherwise)', () => {
    expect(endgameStart(line([START_FEN, QUEENS_OFF_FEN, QUEENS_OFF_FEN]))).toBeNull();
    // The reported case: 1. e4 c6 2. Nf3 d5 3. d3 dxe4 4. dxe4 Qxd1+ 5. Kxd1.
    expect(endgameStart(line([START_FEN, KXD1_FEN, KXD1_FEN]))).toBeNull();
  });

  it('starts when both sides drop to light material, queens still on', () => {
    expect(endgameStart(line([START_FEN, LIGHT_MATERIAL_FEN]))).toBe(1);
  });

  it('returns 0 for a game that starts as an endgame', () => {
    expect(endgameStart(line([LIGHT_MATERIAL_FEN, LIGHT_MATERIAL_FEN]))).toBe(0);
  });

  it('ignores a mid-game dip when material comes back (promotion)', () => {
    // Ply 1 is light material (endgame), ply 2 is heavy (not).
    expect(endgameStart(line([START_FEN, LIGHT_MATERIAL_FEN, HEAVY_FEN]))).toBeNull();
  });

  it('skips nodes without FENs instead of breaking the walk', () => {
    const root = node({
      children: [
        node({
          id: 1,
          ply: 1,
          fen: null,
          children: [node({ id: 2, ply: 2, fen: LIGHT_MATERIAL_FEN })],
        }),
      ],
    });
    expect(endgameStart(root)).toBe(2);
  });
});
