import { Chess } from 'chess.js';
import type { LegalMove } from '@/lib/api';

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
 * Legal moves for a position, computed locally with chess.js — no server
 * round trip per click. Each move carries the resulting FEN (chess.js
 * normalizes the en-passant field away when no capture is possible, which is
 * fine everywhere we consume FENs) and the resulting game status.
 */
export function legalMovesFor(fen: string): LegalMove[] {
  try {
    const game = new Chess(fen);
    return game.moves({ verbose: true }).map((move) => {
      const after = new Chess(move.after);
      return {
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? null,
        san: move.san,
        fen: move.after,
        status: statusOf(after),
      };
    });
  } catch {
    return [];
  }
}
