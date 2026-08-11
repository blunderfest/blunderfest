import { describe, expect, it } from 'vitest';
import { buildNodeMap } from '@/features/analysis/nodeMap';
import { classifyOpening, type OpeningBook } from '@/features/analysis/openings';
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
