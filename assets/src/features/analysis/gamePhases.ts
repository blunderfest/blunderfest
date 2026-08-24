import { type PieceColor, type PieceKind, parseFen } from '@/components/board';
import type { GameNode } from '@/lib/api';

/** Non-pawn piece values in pawns, as the material timeline uses. */
const VALUES: Record<PieceKind, number> = { p: 0, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** A side's non-pawn material (pawns and the king don't count), in pawns. */
function nonPawnMaterial(position: ReturnType<typeof parseFen>, color: PieceColor): number {
  let total = 0;
  for (const piece of position) {
    if (piece !== null && piece.color === color && piece.kind !== 'p' && piece.kind !== 'k') {
      total += VALUES[piece.kind];
    }
  }
  return total;
}

/**
 * The endgame heuristic: no queens on the board, or both sides down to
 * ≤ 13 pawns of non-pawn material (a queen and a minor, two rooks and a
 * minor, …). Queenless heavy-piece positions and pure queen endgames both
 * qualify; a normal middlegame (25 a side) doesn't.
 */
function isEndgame(position: ReturnType<typeof parseFen>): boolean {
  const noQueens = !position.some((piece) => piece?.kind === 'q');
  return noQueens || (nonPawnMaterial(position, 'w') <= 13 && nonPawnMaterial(position, 'b') <= 13);
}

/**
 * Where the endgame began, for the eval chart's phase shading
 * (visualization ideas #1). The earliest ply of the closing stretch in
 * which every position satisfies the endgame heuristic — the *closing*
 * stretch, because promotions can bring queens and material back, so a
 * mid-game dip doesn't shade as an endgame that then un-happens. Pure
 * tree data (FENs); null when the game stays a middlegame, 0 when it
 * starts as an endgame (e.g. a free-form setup).
 */
export function endgameStart(root: GameNode): number | null {
  const mainline: { ply: number; endgame: boolean }[] = [];
  let node: GameNode | null = root;
  while (node !== null) {
    if (node.fen !== null) {
      mainline.push({ ply: node.ply, endgame: isEndgame(parseFen(node.fen)) });
    }
    node = node.children[0] ?? null;
  }

  let start: number | null = null;
  for (let i = mainline.length - 1; i >= 0; i--) {
    if (!mainline[i].endgame) {
      break;
    }
    start = mainline[i].ply;
  }
  return start;
}
