import { describe, expect, it } from 'vitest';
import type { GameNode, GameTree } from '@/lib/api';
import { buildNodeMap } from './nodeMap';

function node(id: number, ply: number, children: GameNode[] = []): GameNode {
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
    children,
  };
}

const tree: GameTree = {
  headers: {},
  result: '*',
  setup: null,
  mainline_ply_count: 2,
  node_count: 3,
  root: node(0, 0, [node(1, 1, [node(2, 2)])]),
};

describe('buildNodeMap', () => {
  it('returns an empty map without a tree', () => {
    expect(buildNodeMap(null).size).toBe(0);
  });

  it('maps every node id to the node and its parent', () => {
    const map = buildNodeMap(tree);
    expect(map.size).toBe(3);
    expect(map.get(0)?.node.id).toBe(0);
    expect(map.get(0)?.parent).toBeNull();
    expect(map.get(1)?.parent?.id).toBe(0);
    expect(map.get(2)?.parent?.id).toBe(1);
  });

  it('includes all children of a node', () => {
    const withVariation = buildNodeMap({
      ...tree,
      root: node(0, 0, [node(1, 1, []), node(2, 1, [])]),
    });
    expect(withVariation.size).toBe(3);
    expect(withVariation.get(2)?.parent?.id).toBe(0);
  });
});
