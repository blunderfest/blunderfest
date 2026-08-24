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
  it('measures the first move against the initial clock, later ones against the previous clock', () => {
    const tree = clockedTree([295, 290, 271], { TimeControl: '300' });

    // Ply 1: 300 − 295 = 5s. Ply 2: 295 − 290 = 5s. Ply 3: 290 − 271 = 19s.
    expect(moveTimes(tree)).toEqual([
      { ply: 1, seconds: 5 },
      { ply: 2, seconds: 5 },
      { ply: 3, seconds: 19 },
    ]);
  });

  it('adds the increment to every move', () => {
    const tree = clockedTree([298, 296], { TimeControl: '300+3' });

    // Ply 1: 300 − 298 + 3 = 5. Ply 2: 298 − 296 + 3 = 5.
    expect(moveTimes(tree)).toEqual([
      { ply: 1, seconds: 5 },
      { ply: 2, seconds: 5 },
    ]);
  });

  it('skips the first move without a TimeControl header but keeps the rest', () => {
    const tree = clockedTree([295, 290, 271]);

    expect(moveTimes(tree)).toEqual([
      { ply: 2, seconds: 5 },
      { ply: 3, seconds: 19 },
    ]);
  });

  it('returns nothing for a game without clock data', () => {
    expect(moveTimes(clockedTree([null, null], { TimeControl: '300' }))).toEqual([]);
  });

  it('stops the chain at an unclocked move (no bogus "before")', () => {
    const tree = clockedTree([295, null, 260, 250], { TimeControl: '300' });

    // Ply 3 has no "before" (ply 2 unclocked); ply 4 measures against ply 3.
    expect(moveTimes(tree)).toEqual([
      { ply: 1, seconds: 5 },
      { ply: 4, seconds: 10 },
    ]);
  });

  it('drops impossible negative times (clock anomalies)', () => {
    const tree = clockedTree([301, 290], { TimeControl: '300' });

    expect(moveTimes(tree)).toEqual([{ ply: 2, seconds: 11 }]);
  });
});
