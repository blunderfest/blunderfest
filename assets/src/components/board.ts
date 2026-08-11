import { Chess } from 'chess.js';

export type PieceColor = 'w' | 'b';
export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Piece = { color: PieceColor; kind: PieceKind };

// Index 0 = a8 ... index 63 = h1 (same convention as the backend)
export type Position = (Piece | null)[];

/**
 * The piece image: the cburnett SVG set (GPLv2+, attribution in
 * public/pieces/cburnett/NOTICE.txt). Crisp at any size and identical on
 * every platform, unlike font glyphs.
 */
export function pieceSrc(piece: Piece): string {
  return `/pieces/cburnett/${piece.color}${piece.kind.toUpperCase()}.svg`;
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
 * A board arrow from `from` to `to` in 8×8 SVG space: the line shortened at
 * the tail, and the arrowhead as an explicit polygon whose base is exactly
 * the line's end and whose tip sits inside the target square. Explicit
 * geometry — SVG marker refX/orient quirks put the tip in the wrong place.
 */
export function arrowShape(
  from: string,
  to: string,
  flipped = false,
  tailInset = 0.3,
  tipInset = 0,
  headLength = 0.7,
  headWidth = 0.55,
): { line: { x1: number; y1: number; x2: number; y2: number }; head: string } | null {
  const start = squarePoint(from, flipped);
  const end = squarePoint(to, flipped);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return null;
  }
  const ux = dx / length;
  const uy = dy / length;

  const tipX = end.x - ux * tipInset;
  const tipY = end.y - uy * tipInset;
  const baseX = tipX - ux * headLength;
  const baseY = tipY - uy * headLength;
  const perpX = -uy;
  const perpY = ux;

  const line = {
    x1: start.x + ux * tailInset,
    y1: start.y + uy * tailInset,
    x2: baseX,
    y2: baseY,
  };
  const head = `${tipX},${tipY} ${baseX + perpX * (headWidth / 2)},${baseY + perpY * (headWidth / 2)} ${baseX - perpX * (headWidth / 2)},${baseY - perpY * (headWidth / 2)}`;
  return { line, head };
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

/**
 * Serializes a board position to a FEN. Castling and en passant are reset —
 * free-form setups rarely preserve them (ADR-0011).
 */
export function positionToFen(position: Position, turn: PieceColor, fullmove = 1): string {
  const rows: string[] = [];
  for (let rank = 0; rank < 8; rank += 1) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const piece = position[rank * 8 + file];
      if (piece === null || piece === undefined) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }
      row += piece.color === 'w' ? piece.kind.toUpperCase() : piece.kind;
    }
    if (empty > 0) {
      row += String(empty);
    }
    rows.push(row);
  }
  return `${rows.join('/')} ${turn} - - 0 ${fullmove}`;
}

/**
 * The board square at a client point, or null when outside the board. Used
 * for drag & drop and right-button drawing, where the event target is not a
 * square button.
 */
export function squareFromPoint(
  rect: { left: number; top: number; width: number; height: number },
  x: number,
  y: number,
  flipped: boolean,
): string | null {
  if (rect.width === 0) {
    return null;
  }
  const size = rect.width / 8;
  let file = Math.floor((x - rect.left) / size);
  let row = Math.floor((y - rect.top) / size);
  if (file < 0 || file > 7 || row < 0 || row > 7) {
    return null;
  }
  if (flipped) {
    file = 7 - file;
    row = 7 - row;
  }
  return squareName(row * 8 + file);
}

/**
 * The drawing colors for board annotations. Chosen for contrast on both
 * board shades — and deliberately NOT driven by modifier keys: Firefox
 * force-shows its context menu on Shift+right-click and macOS on
 * Ctrl+click, so modifiers can't carry color.
 */
export const DRAW_COLORS = ['#3b82f6', '#4caf50', '#a855f7', '#e05a4e'] as const;
