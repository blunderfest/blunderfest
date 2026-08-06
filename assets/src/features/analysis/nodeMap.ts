import type { GameNode, GameTree } from '@/lib/api';

export type Entry = { node: GameNode; parent: GameNode | null };

/**
 * Maps every node id in the tree to the node and its parent, for O(1)
 * current-node and parent lookups.
 */
export function buildNodeMap(tree: GameTree | null): Map<number, Entry> {
  const map = new Map<number, Entry>();
  const walk = (node: GameNode, parent: GameNode | null) => {
    map.set(node.id, { node, parent });
    node.children.forEach((child) => {
      walk(child, node);
    });
  };
  if (tree) {
    walk(tree.root, null);
  }
  return map;
}
