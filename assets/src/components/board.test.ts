import { describe, expect, it } from 'vitest';
import {
  arrowShape,
  isLightSquare,
  kingInCheckSquare,
  parseFen,
  pieceSrc,
  positionToFen,
  squareFromPoint,
  squareIndex,
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

describe('pieceSrc', () => {
  it('maps every piece kind and color to its SVG', () => {
    expect(pieceSrc({ color: 'w', kind: 'k' })).toBe('/pieces/cburnett/wK.svg');
    expect(pieceSrc({ color: 'b', kind: 'k' })).toBe('/pieces/cburnett/bK.svg');
    expect(pieceSrc({ color: 'w', kind: 'p' })).toBe('/pieces/cburnett/wP.svg');
    expect(pieceSrc({ color: 'b', kind: 'p' })).toBe('/pieces/cburnett/bP.svg');
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

describe('arrowShape', () => {
  it('ends the line exactly at the arrowhead base, tip inside the target square', () => {
    const shape = arrowShape('e2', 'e4');
    if (shape === null) {
      throw new Error('expected a shape');
    }
    const { line, head } = shape;
    expect(line.x1).toBeCloseTo(4.5);
    expect(line.y1).toBeCloseTo(6.2);
    expect(line.x2).toBeCloseTo(4.5);
    expect(line.y2).toBeCloseTo(5.2);

    const [tip, baseA, baseB] = head.split(' ').map((point) => point.split(',').map(Number));
    expect(tip[0]).toBeCloseTo(4.5);
    expect(tip[1]).toBeCloseTo(4.5);
    expect(baseA[1]).toBeCloseTo(5.2);
    expect(baseB[1]).toBeCloseTo(5.2);
  });

  it('mirrors the arrow when flipped', () => {
    const shape = arrowShape('e2', 'e4', true);
    if (shape === null) {
      throw new Error('expected a shape');
    }
    expect(shape.line.x1).toBeCloseTo(3.5);
    expect(shape.line.y1).toBeCloseTo(1.8);
    expect(shape.line.x2).toBeCloseTo(3.5);
    expect(shape.line.y2).toBeCloseTo(2.8);
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

describe('positionToFen', () => {
  it('serializes the start position', () => {
    expect(positionToFen(parseFen(start), 'w', 1)).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
    );
  });

  it('serializes an edited position with the side to move', () => {
    const position = parseFen(start);
    position[squareIndex('h3')] = position[squareIndex('e2')];
    position[squareIndex('e2')] = null;
    expect(positionToFen(position, 'b', 7)).toBe(
      'rnbqkbnr/pppppppp/8/8/8/7P/PPPP1PPP/RNBQKBNR b - - 0 7',
    );
  });
});

describe('squareFromPoint', () => {
  const rect = { left: 0, top: 0, width: 800, height: 800 };

  it('maps points to squares', () => {
    expect(squareFromPoint(rect, 450, 650, false)).toBe('e2');
    expect(squareFromPoint(rect, 450, 450, false)).toBe('e4');
    expect(squareFromPoint(rect, 5, 5, false)).toBe('a8');
  });

  it('mirrors when flipped', () => {
    expect(squareFromPoint(rect, 450, 650, true)).toBe('d7');
  });

  it('returns null outside the board', () => {
    expect(squareFromPoint(rect, -5, 100, false)).toBeNull();
    expect(squareFromPoint(rect, 100, 900, false)).toBeNull();
  });
});
