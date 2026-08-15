import { Chess } from 'chess.js';

/**
 * Pure UCI output parsing and eval formatting for the in-browser Stockfish
 * engine. No engine, no DOM — everything here is unit-tested directly.
 */

export type InfoScore = { type: 'cp'; cp: number } | { type: 'mate'; mate: number };

export type InfoLine = {
  depth: number | null;
  score: InfoScore | null;
  /** The rank in a MultiPV search (1 = best); null in single-line output. */
  multipv: number | null;
  pv: string[];
};

export function parseInfoLine(line: string): InfoLine | null {
  const match = /^info\s+(.*)$/.exec(line);
  if (match === null) {
    return null;
  }
  const tokens = match[1].split(/\s+/);
  const result: InfoLine = { depth: null, score: null, multipv: null, pv: [] };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === 'depth' && i + 1 < tokens.length) {
      const depth = Number.parseInt(tokens[i + 1], 10);
      result.depth = Number.isNaN(depth) ? null : depth;
    } else if (token === 'score' && i + 2 < tokens.length) {
      if (tokens[i + 1] === 'cp') {
        result.score = { type: 'cp', cp: Number.parseInt(tokens[i + 2], 10) };
      } else if (tokens[i + 1] === 'mate') {
        result.score = { type: 'mate', mate: Number.parseInt(tokens[i + 2], 10) };
      }
    } else if (token === 'multipv' && i + 1 < tokens.length) {
      const rank = Number.parseInt(tokens[i + 1], 10);
      result.multipv = Number.isNaN(rank) ? null : rank;
    } else if (token === 'pv' && i + 1 < tokens.length) {
      result.pv = tokens.slice(i + 1);
      break;
    }
  }
  return result;
}

export function parseBestMove(line: string): string | null {
  const match = /^bestmove\s+(\S+)/.exec(line);
  return match === null ? null : match[1];
}

export function bestMoveSquares(move: string): { from: string; to: string } | null {
  if (move === '(none)' || move.length < 4) {
    return null;
  }
  return { from: move.slice(0, 2), to: move.slice(2, 4) };
}

/**
 * Evaluation from the side to move, converted to white's perspective.
 * `result` is for terminal positions (checkmate/stalemate/draw), where there
 * is no eval to compute — the outcome itself is displayed.
 */
export type WhiteEval =
  | { type: 'cp'; cp: number }
  | { type: 'mate'; moves: number }
  | { type: 'result'; result: string };

export function whiteEval(score: InfoScore, sideToMove: 'w' | 'b'): WhiteEval {
  if (score.type === 'mate') {
    return { type: 'mate', moves: sideToMove === 'w' ? score.mate : -score.mate };
  }
  return { type: 'cp', cp: sideToMove === 'w' ? score.cp : -score.cp };
}

export function evalLabel(white: WhiteEval): string {
  if (white.type === 'result') {
    return white.result;
  }
  if (white.type === 'mate') {
    return white.moves > 0 ? `M${white.moves}` : `-M${-white.moves}`;
  }
  const sign = white.cp >= 0 ? '+' : '-';
  return `${sign}${(Math.abs(white.cp) / 100).toFixed(2)}`;
}

/**
 * The fraction of the eval bar that belongs to white, as a percentage.
 * Centipawns map to roughly 6% per pawn; mates sit at the extremes.
 */
export function whiteShare(white: WhiteEval | null): number {
  if (white === null) {
    return 50;
  }
  if (white.type === 'result') {
    return white.result === '1-0' ? 98 : white.result === '0-1' ? 2 : 50;
  }
  if (white.type === 'mate') {
    return white.moves > 0 ? 98 : 2;
  }
  const share = 50 + (white.cp / 100) * 6;
  return Math.min(97, Math.max(3, share));
}

/**
 * Converts a UCI principal variation (`e2e4 e7e5 …`) into SAN moves for
 * display. Stops at the first move that does not apply cleanly.
 */
export function pvToSan(fen: string, pv: string[]): string[] {
  const game = new Chess(fen);
  const san: string[] = [];
  for (const uci of pv) {
    try {
      const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      san.push(move.san);
    } catch {
      break;
    }
  }
  return san;
}
