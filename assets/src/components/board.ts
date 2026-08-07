import { Chess } from 'chess.js';

export type PieceColor = 'w' | 'b';
export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Piece = { color: PieceColor; kind: PieceKind };

// Index 0 = a8 ... index 63 = h1 (same convention as the backend)
export type Position = (Piece | null)[];

// Filled glyphs for both sides: piece color comes from CSS (white pieces get
// a light fill with a dark outline) — solid silhouettes stay readable at any
// size, while outline glyphs fade against the board.
const glyphs: Record<PieceColor, Record<PieceKind, string>> = {
  w: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

export function pieceGlyph(color: PieceColor, kind: PieceKind): string {
  return glyphs[color][kind];
}

export function parseFen(fen: string): Position {
  const position: Position = new Array(64).fill(null);
  const [placement] = fen.split(' ');
  let index = 0;

  for (const char of placement) {
    if (char === '/') {
      continue;
    }
    const empty = Number(char);
    if (!Number.isNaN(empty)) {
      index += empty;
      continue;
    }
    position[index] = {
      color: char === char.toUpperCase() ? 'w' : 'b',
      kind: char.toLowerCase() as PieceKind,
    };
    index += 1;
  }

  return position;
}

export function squareName(index: number): string {
  return `${'abcdefgh'[index % 8]}${8 - Math.floor(index / 8)}`;
}

export function squareIndex(name: string): number {
  const file = name.charCodeAt(0) - 97;
  const rank = Number(name[1]);
  return (8 - rank) * 8 + file;
}

export function isLightSquare(index: number): boolean {
  const file = index % 8;
  const rank = 8 - Math.floor(index / 8);
  return (file + rank) % 2 === 0;
}

/**
 * The center of `square` in 8×8 SVG space (x: file 0–8, y: rank 8 at the top
 * and rank 1 at the bottom). `flipped` mirrors both axes, matching the
 * board's display order.
 */
export function squarePoint(square: string, flipped = false): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  let x = file + 0.5;
  let y = 7 - rank + 0.5;
  if (flipped) {
    x = 8 - x;
    y = 8 - y;
  }
  return { x, y };
}

/**
 * A board arrow from `from` to `to` in 8×8 SVG space, shortened at both ends
 * so the tail clears the origin piece and the arrowhead sits inside the
 * target square.
 */
export function arrowLine(
  from: string,
  to: string,
  flipped = false,
  tailInset = 0.3,
  headInset = 0.6,
): { x1: number; y1: number; x2: number; y2: number } {
  const start = squarePoint(from, flipped);
  const end = squarePoint(to, flipped);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  }
  const ux = dx / length;
  const uy = dy / length;
  return {
    x1: start.x + ux * tailInset,
    y1: start.y + uy * tailInset,
    x2: end.x - ux * headInset,
    y2: end.y - uy * headInset,
  };
}

/**
 * The square of the king that is currently in check, or null. Derived from
 * the FEN via chess.js (the side to move is the side that can be in check).
 */
export function kingInCheckSquare(fen: string): string | null {
  try {
    const game = new Chess(fen);
    if (!game.isCheck()) {
      return null;
    }
    const turn = game.turn();
    for (const row of game.board()) {
      for (const square of row) {
        if (square !== null && square.type === 'k' && square.color === turn) {
          return square.square;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}
