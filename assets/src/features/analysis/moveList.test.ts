import { describe, expect, it } from 'vitest';
import type { GameNode, GameTree } from '@/lib/api';
import { buildRows } from './moveList';

function node(id: number, ply: number, partial: Partial<GameNode> = {}): GameNode {
  return {
    id,
    ply,
    san: null,
    from: null,
    to: null,
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    fen: null,
    children: [],
    ...partial,
  };
}

const tree: GameTree = {
  headers: {},
  result: '*',
  setup: null,
  mainline_ply_count: 3,
  node_count: 5,
  root: node(0, 0, {
    children: [
      node(1, 1, {
        san: 'e4',
        children: [
          node(2, 2, {
            san: 'e5',
            children: [
              node(3, 3, { san: 'Nf3', children: [node(4, 4, { san: 'Nc6' })] }),
              node(5, 3, { san: 'Nc3' }),
            ],
          }),
          node(6, 2, { san: 'c5' }),
        ],
      }),
    ],
  }),
};

describe('buildRows', () => {
  it('returns an empty list without a tree', () => {
    expect(buildRows(null)).toEqual([]);
  });

  it('produces a pair per mainline move', () => {
    const rows = buildRows(tree);
    const pairs = rows.filter((row) => row.type === 'pair');
    expect(pairs).toHaveLength(2);
  });

  it('groups black moves with their white move', () => {
    const [first, second] = buildRows(tree).filter((row) => row.type === 'pair');
    if (first.type !== 'pair' || second.type !== 'pair') {
      throw new Error('expected pairs');
    }
    expect(first.white.san).toBe('e4');
    expect(first.black?.san).toBe('e5');
    expect(second.white.san).toBe('Nf3');
    expect(second.black?.san).toBe('Nc6');
  });

  it('emits variations right after the move they branch from', () => {
    const rows = buildRows(tree);
    expect(
      rows.map((row) => (row.type === 'pair' ? row.white.san : `var:${row.root.san}`)),
    ).toEqual(['e4', 'var:c5', 'var:Nc3', 'Nf3']);
  });
});
