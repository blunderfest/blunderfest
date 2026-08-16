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

/**
 * Converts a UCI move list (e.g. an engine's principal variation, "e2e4"
 * "e7e8q") into fully-described moves from `fen`, each legality-checked
 * against the running position. Stops short (possibly empty) at the first
 * move that isn't legal — callers insert whatever prefix resolved.
 */
export function uciLineToMoves(fen: string, uciMoves: string[]): LegalMove[] {
  const moves: LegalMove[] = [];
  let currentFen = fen;
  for (const uci of uciMoves) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci.slice(4) : null;
    const move = legalMovesFor(currentFen).find(
      (candidate) =>
        candidate.from === from &&
        candidate.to === to &&
        (candidate.promotion ?? null) === promotion,
    );
    if (move === undefined) {
      break;
    }
    moves.push(move);
    currentFen = move.fen;
  }
  return moves;
}
