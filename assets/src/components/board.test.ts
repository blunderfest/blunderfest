import { describe, expect, it } from 'vitest';
import {
  arrowLine,
  isLightSquare,
  kingInCheckSquare,
  parseFen,
  pieceGlyph,
  squareName,
  squarePoint,
} from '@/components/board';

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('parseFen', () => {
  it('parses the start position', () => {
    const position = parseFen(start);

    expect(position[0]).toEqual({ color: 'b', kind: 'r' });
    expect(position[7]).toEqual({ color: 'b', kind: 'r' });
    expect(position[4]).toEqual({ color: 'b', kind: 'k' });
    expect(position[63]).toEqual({ color: 'w', kind: 'r' });
    expect(position[60]).toEqual({ color: 'w', kind: 'k' });
    expect(position[8]).toEqual({ color: 'b', kind: 'p' });
    expect(position[55]).toEqual({ color: 'w', kind: 'p' });
    expect(position[27]).toBeNull();
  });

  it('parses a mid-game FEN with empty ranks', () => {
    const position = parseFen('4k3/8/4N3/8/4N3/8/8/4K3 w - - 0 1');

    expect(position[20]).toEqual({ color: 'w', kind: 'n' });
    expect(position[36]).toEqual({ color: 'w', kind: 'n' });
    expect(position[60]).toEqual({ color: 'w', kind: 'k' });
    expect(position[4]).toEqual({ color: 'b', kind: 'k' });
    expect(position.filter(Boolean)).toHaveLength(4);
  });
});

describe('squareName', () => {
  it('maps index to algebraic squares', () => {
    expect(squareName(0)).toBe('a8');
    expect(squareName(4)).toBe('e8');
    expect(squareName(28)).toBe('e5');
    expect(squareName(63)).toBe('h1');
  });
});

describe('isLightSquare', () => {
  it('follows the standard checkerboard', () => {
    expect(isLightSquare(0)).toBe(true);
    expect(isLightSquare(7)).toBe(false);
    expect(isLightSquare(63)).toBe(true);
    expect(isLightSquare(60)).toBe(false);
  });
});

describe('pieceGlyph', () => {
  it('maps every piece kind and color to a glyph', () => {
    expect(pieceGlyph('w', 'k')).toBe('♚');
    expect(pieceGlyph('b', 'k')).toBe('♚');
    expect(pieceGlyph('w', 'p')).toBe('♟');
    expect(pieceGlyph('b', 'p')).toBe('♟');
  });
});

describe('squarePoint', () => {
  it('centers squares in 8x8 space', () => {
    expect(squarePoint('a1')).toEqual({ x: 0.5, y: 7.5 });
    expect(squarePoint('h8')).toEqual({ x: 7.5, y: 0.5 });
    expect(squarePoint('e4')).toEqual({ x: 4.5, y: 4.5 });
  });

  it('mirrors the board when flipped', () => {
    expect(squarePoint('e4', true)).toEqual({ x: 3.5, y: 3.5 });
    expect(squarePoint('a1', true)).toEqual({ x: 7.5, y: 0.5 });
  });
});

describe('arrowLine', () => {
  it('shortens the line at both ends', () => {
    const line = arrowLine('e2', 'e4');
    expect(line.x1).toBeCloseTo(4.5);
    expect(line.y1).toBeCloseTo(6.2);
    expect(line.x2).toBeCloseTo(4.5);
    expect(line.y2).toBeCloseTo(5.1);
  });

  it('mirrors the arrow when flipped', () => {
    const line = arrowLine('e2', 'e4', true);
    expect(line.x1).toBeCloseTo(3.5);
    expect(line.y1).toBeCloseTo(1.8);
    expect(line.x2).toBeCloseTo(3.5);
    expect(line.y2).toBeCloseTo(2.9);
  });
});

describe('kingInCheckSquare', () => {
  it('returns the checked king square for a check position', () => {
    expect(kingInCheckSquare('4k3/8/8/8/8/8/4R3/4K3 b - - 0 1')).toBe('e8');
  });

  it('returns null when nobody is in check', () => {
    expect(
      kingInCheckSquare('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).toBeNull();
  });

  it('returns null for garbage input instead of throwing', () => {
    expect(kingInCheckSquare('not a fen')).toBeNull();
  });
});
