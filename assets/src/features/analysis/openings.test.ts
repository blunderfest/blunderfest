import { describe, expect, it } from 'vitest';
import { buildNodeMap } from '@/features/analysis/nodeMap';
import {
  classifyOpening,
  continuationsFor,
  isBookPosition,
  type OpeningBook,
  openingExitPly,
} from '@/features/analysis/openings';
import type { GameNode, GameTree } from '@/lib/api';

function node(partial: Partial<GameNode> & { id: number }): GameNode {
  return {
    ply: 1,
    san: 'e4',
    from: 'e2',
    to: 'e4',
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    fen: null,
    children: [],
    ...partial,
  };
}

function treeWith(root: GameNode): GameTree {
  return {
    headers: {},
    result: '*',
    setup: null,
    root,
    mainline_ply_count: 0,
    node_count: 0,
  };
}

// Synthetic positions are enough: classification only splits the FEN.
const fen = (name: string) => `${name} w - - 0 1`;

const book: OpeningBook = {
  [`${fen('after-e4').split(' ').slice(0, 3).join(' ')}`]: 'B00|King Pawn',
  [`${fen('after-e4-e5').split(' ').slice(0, 3).join(' ')}`]: 'C20|Open Game',
};

const root = node({
  id: 0,
  ply: 0,
  san: null,
  from: null,
  to: null,
  fen: fen('start'),
  children: [
    node({
      id: 1,
      ply: 1,
      san: 'e4',
      fen: fen('after-e4'),
      children: [
        node({
          id: 2,
          ply: 2,
          san: 'e5',
          from: 'e7',
          to: 'e5',
          fen: fen('after-e4-e5'),
          children: [
            node({ id: 3, ply: 3, san: 'Nf3', from: 'g1', to: 'f3', fen: fen('off-book') }),
          ],
        }),
        node({ id: 4, ply: 2, san: 'c5', from: 'c7', to: 'c5', fen: fen('sicilian') }),
      ],
    }),
  ],
});

const byId = buildNodeMap(treeWith(root));

describe('classifyOpening', () => {
  it('returns the deepest book position on the line', () => {
    const nf3 = byId.get(3)?.node ?? null;
    expect(classifyOpening(book, byId, nf3)).toEqual({ eco: 'C20', name: 'Open Game' });
  });

  it('returns null when no position on the path is in the book', () => {
    expect(classifyOpening({}, byId, byId.get(3)?.node ?? null)).toBeNull();
  });

  it('follows the viewed line, not the mainline', () => {
    // The c5 variation's position isn't in the book; its parent's is.
    expect(classifyOpening(book, byId, byId.get(4)?.node ?? null)).toEqual({
      eco: 'B00',
      name: 'King Pawn',
    });
  });

  it('classifies by position, so transpositions match', () => {
    // A different move order reaching the same position (same FEN).
    const transposed = node({
      id: 9,
      ply: 9,
      san: 'Nc3',
      from: 'b1',
      to: 'c3',
      fen: fen('after-e4-e5'),
    });
    const transposedTree = treeWith(
      node({
        id: 0,
        ply: 0,
        san: null,
        from: null,
        to: null,
        fen: fen('start'),
        children: [transposed],
      }),
    );
    expect(classifyOpening(book, buildNodeMap(transposedTree), transposed)).toEqual({
      eco: 'C20',
      name: 'Open Game',
    });
  });

  it('falls through setup nodes (no position) to the parent', () => {
    const setupNode = node({ id: 10, ply: 3, san: null, from: null, to: null, fen: null });
    const withSetup = treeWith(
      node({
        id: 0,
        ply: 0,
        san: null,
        from: null,
        to: null,
        fen: fen('start'),
        children: [
          node({
            id: 1,
            ply: 1,
            san: 'e4',
            fen: fen('after-e4'),
            children: [setupNode],
          }),
        ],
      }),
    );
    expect(classifyOpening(book, buildNodeMap(withSetup), setupNode)).toEqual({
      eco: 'B00',
      name: 'King Pawn',
    });
  });
});

describe('openingExitPly', () => {
  it('returns the first mainline ply outside the book', () => {
    // e4 and e5 are in the book; Nf3 (ply 3) is not.
    expect(openingExitPly(book, root)).toBe(3);
  });

  it('returns null when the game never enters the book', () => {
    expect(openingExitPly({}, root)).toBeNull();
  });

  it('returns null when the game never leaves the book', () => {
    const theory = node({
      id: 0,
      ply: 0,
      san: null,
      fen: fen('after-e4'),
      children: [node({ id: 1, ply: 1, fen: fen('after-e4-e5') })],
    });
    expect(openingExitPly(book, theory)).toBeNull();
  });
});

describe('isBookPosition', () => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('counts the standard starting position as in the book', () => {
    // The corpus has no entry for the start position — it is in the book
    // by definition, otherwise a fresh board reads as out of book.
    expect(isBookPosition({}, START)).toBe(true);
  });

  it('otherwise requires a keyed position', () => {
    const keyed = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq';
    const book: OpeningBook = { [keyed]: 'B00|King Pawn' };
    expect(isBookPosition(book, `${keyed} - 0 1`)).toBe(true);
    expect(isBookPosition(book, START.replace(' w ', ' b '))).toBe(false);
  });
});

describe('continuationsFor', () => {
  // Real FENs — continuations are computed with chess.js legality.
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const realBook: OpeningBook = {
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': 'B00|King Pawn',
    'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': 'A40|Queen Pawn',
  };

  it('returns the named continuations of a position, sorted by SAN', () => {
    const rows = continuationsFor(realBook, START);
    expect(rows.map((row) => row.san)).toEqual(['d4', 'e4']);
    expect(rows.find((row) => row.san === 'e4')).toMatchObject({ eco: 'B00', name: 'King Pawn' });
  });

  it('carries the full LegalMove so lines insert without recomputation', () => {
    const e4 = continuationsFor(realBook, START).find((row) => row.san === 'e4');
    expect(e4).toMatchObject({ from: 'e2', to: 'e4', promotion: null });
    expect(e4?.fen).toContain('4P3');
  });

  it('is empty off-book and for null positions', () => {
    expect(continuationsFor(realBook, '8/8/8/8/8/8/4K3/4k3 w - - 0 1')).toEqual([]);
    expect(continuationsFor(realBook, null)).toEqual([]);
  });
});
