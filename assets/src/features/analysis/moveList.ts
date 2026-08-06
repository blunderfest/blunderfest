import type { GameNode, GameTree } from '@/lib/api';

export type Row =
  | { type: 'pair'; white: GameNode; black: GameNode | null }
  | { type: 'variation'; root: GameNode };

/**
 * Flattens the tree into move-list rows: mainline white/black pairs with
 * variations grouped underneath the move they branch from.
 */
export function buildRows(tree: GameTree | null): Row[] {
  if (!tree) {
    return [];
  }
  const result: Row[] = [];
  let node: GameNode | null = tree.root.children[0] ?? null;
  while (node) {
    const white: GameNode = node;
    const black: GameNode | null =
      white.children[0] && white.children[0].ply % 2 === 0 ? white.children[0] : null;
    result.push({ type: 'pair', white, black });
    white.children.slice(1).forEach((child) => {
      result.push({ type: 'variation', root: child });
    });
    if (black) {
      black.children.slice(1).forEach((child) => {
        result.push({ type: 'variation', root: child });
      });
    }
    node = black ? (black.children[0] ?? null) : (white.children[0] ?? null);
  }
  return result;
}
