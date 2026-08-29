import { Chess } from 'chess.js';

export const PASS_SAN = '--';

/**
 * A pass (null move): flips the side to move without touching a piece.
 * Substitutes field 1 (w↔b) and clears en passant (field 3). The fullmove
 * counter NEVER advances on a pass — passes aren't moves; stacked passes
 * stay at the same move number, and the tree's ply parity carries the
 * move list's numbering.
 */
export type PassMove = {
  from: null;
  to: null;
  promotion: null;
  san: string;
  fen: string;
  status: string;
};

export function flipSideToMove(fen: string): string | null {
  const fields = fen.split(' ');
  if (fields.length < 2) {
    return null;
  }
  const [board, side, castling, _ep, halfmove, fullmove] = fields;
  const newSide = side === 'w' ? 'b' : 'w';
  return [board, newSide, castling ?? '-', '-', halfmove ?? '0', fullmove ?? '1'].join(' ');
}

function statusOf(game: Chess): string {
  if (game.isCheckmate()) {
    return 'checkmate';
  }
  if (game.isStalemate()) {
    return 'stalemate';
  }
  if (game.isDraw()) {
    return 'draw';
  }
  return 'active';
}

/**
 * The pass payload underneath implicit passing — null from/to (like a
 * setup node), san `'--'` so the move list never renders the Setup glyph.
 * Status falls back to 'active' for degenerate FENs chess.js rejects.
 */
export function buildPass(fen: string): PassMove | null {
  const flipped = flipSideToMove(fen);
  if (flipped === null) {
    return null;
  }
  let status = 'active';
  try {
    status = statusOf(new Chess(flipped));
  } catch {
    status = 'active';
  }
  return { from: null, to: null, promotion: null, san: PASS_SAN, fen: flipped, status };
}
