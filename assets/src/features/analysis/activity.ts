import { Chess } from 'chess.js';
import type { GameNode } from '@/lib/api';

export type ActivityPoint = { ply: number; white: number; black: number };

/**
 * Piece activity over the mainline: how many legal moves each side has at
 * every ply (mobility — "did my pieces become passive?"). The other side's
 * mobility comes from the same position with the turn flipped. Pure tree
 * data (FENs), no engine needed.
 */
export function activityTimeline(root: GameNode): ActivityPoint[] {
  const points: ActivityPoint[] = [];
  let node: GameNode | null = root;
  while (node !== null) {
    if (node.fen !== null) {
      const white = mobilityOf(node.fen, 'w');
      const black = mobilityOf(node.fen, 'b');
      if (white !== null && black !== null) {
        points.push({ ply: node.ply, white, black });
      }
    }
    node = node.children[0] ?? null;
  }
  return points;
}

function mobilityOf(fen: string, side: 'w' | 'b'): number | null {
  const parts = fen.split(' ');
  parts[1] = side;
  try {
    return new Chess(parts.join(' ')).moves().length;
  } catch {
    return null;
  }
}
