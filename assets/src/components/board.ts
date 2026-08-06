export type PieceColor = 'w' | 'b';
export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Piece = { color: PieceColor; kind: PieceKind };

// Index 0 = a8 … index 63 = h1 (same convention as the backend)
export type Position = (Piece | null)[];

const glyphs: Record<PieceColor, Record<PieceKind, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
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
