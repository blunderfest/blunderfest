import { describe, expect, it } from 'vitest';
import { moveTimes, timeControl } from '@/features/analysis/moveTimes';
import type { GameNode, GameTree } from '@/lib/api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function node(partial: Partial<GameNode>): GameNode {
  return {
    id: 0,
    ply: 0,
    san: null,
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

/** A clocked mainline: `[seconds after move]` per ply, ply 0 = root. */
function clockedTree(clocks: (number | null)[], headers: Record<string, string> = {}): GameTree {
  const root = node({ id: 0, ply: 0, children: [] });
  let current = root;
  clocks.forEach((clock, i) => {
    const ply = i + 1;
    const next = node({ id: ply, ply, san: 'e4', clock });
    current.children = [next];
    current = next;
  });
  return {
    headers,
    result: '*',
    setup: null,
    root,
    mainline_ply_count: clocks.length,
    node_count: clocks.length + 1,
  };
}

describe('timeControl', () => {
  it('reads initial and increment from the header', () => {
    expect(timeControl({ TimeControl: '300+3' })).toEqual({ initial: 300, increment: 3 });
    expect(timeControl({ TimeControl: '180' })).toEqual({ initial: 180, increment: 0 });
  });

  it('returns null without a header or for non-simple controls', () => {
    expect(timeControl({})).toBeNull();
    expect(timeControl({ TimeControl: '?' })).toBeNull();
    expect(timeControl({ TimeControl: '-' })).toBeNull();
    expect(timeControl({ TimeControl: '40/7200+30' })).toBeNull();
  });
});

describe('moveTimes', () => {
  it('measures each side against its own clock, both firsts against the initial', () => {
    // w: 300→295 (5s), b: 300→290 (10s), w: 295→271 (24s).
    const tree = clockedTree([295, 290, 271], { TimeControl: '300' });

    expect(moveTimes(tree)).toEqual([
      { ply: 1, mover: 'w', seconds: 5 },
      { ply: 2, mover: 'b', seconds: 10 },
      { ply: 3, mover: 'w', seconds: 24 },
    ]);
  });

  it('adds the increment to every move, firsts included', () => {
    // w: 300−298+3=5, b: 300−296+3=7.
    const tree = clockedTree([298, 296], { TimeControl: '300+3' });

    expect(moveTimes(tree)).toEqual([
      { ply: 1, mover: 'w', seconds: 5 },
      { ply: 2, mover: 'b', seconds: 7 },
    ]);
  });

  it('charts black ahead on the clock (the old cross-side math went negative)', () => {
    // Black ends every exchange with more time than white had: cross-side
    // subtraction would drop the black bars entirely.
    const tree = clockedTree([290, 298, 285, 296], { TimeControl: '300' });

    expect(moveTimes(tree)).toEqual([
      { ply: 1, mover: 'w', seconds: 10 },
      { ply: 2, mover: 'b', seconds: 2 },
      { ply: 3, mover: 'w', seconds: 5 },
      { ply: 4, mover: 'b', seconds: 2 },
    ]);
  });

  it('skips a side first move without a TimeControl header, keeps later clock pairs', () => {
    // No initial clock: both first moves are unmeasurable; ply 3 is white's
    // second move against his own first clock (295 − 271 = 24).
    const tree = clockedTree([295, 290, 271]);

    expect(moveTimes(tree)).toEqual([{ ply: 3, mover: 'w', seconds: 24 }]);
  });

  it('returns nothing for a game without clock data', () => {
    expect(moveTimes(clockedTree([null, null], { TimeControl: '300' }))).toEqual([]);
  });

  it('an unclocked move breaks only its own side\u2019s chain', () => {
    // Black's ply 2 is unclocked: white's times survive, black's ply 4 has
    // no "before" and is skipped.
    const tree = clockedTree([295, null, 260, 250], { TimeControl: '300' });

    expect(moveTimes(tree)).toEqual([
      { ply: 1, mover: 'w', seconds: 5 },
      { ply: 3, mover: 'w', seconds: 35 },
    ]);
  });

  it('drops impossible negative times (clock anomalies)', () => {
    // White's ply-1 clock (301) exceeds the initial (300): dropped; black's
    // first (before = 300) is exact.
    const tree = clockedTree([301, 290], { TimeControl: '300' });

    expect(moveTimes(tree)).toEqual([{ ply: 2, mover: 'b', seconds: 10 }]);
  });
});
