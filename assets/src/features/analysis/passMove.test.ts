import { describe, expect, it } from 'vitest';
import { buildPass, flipSideToMove } from '@/features/analysis/passMove';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('flipSideToMove', () => {
  it('white to move flips to black, ep cleared, fullmove unchanged', () => {
    const flipped = flipSideToMove(START);
    expect(flipped).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');
  });

  it('black to move flips to white WITHOUT bumping the fullmove counter', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2';
    const flipped = flipSideToMove(fen);
    expect(flipped).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  });

  it('double-flip returns the original side and counters', () => {
    const once = flipSideToMove(START);
    if (once === null) {
      return;
    }
    const twice = flipSideToMove(once);
    // Only the en-passant marker drops (already absent in START).
    expect(twice).toBe(START);
  });

  it('rejects a FEN without a side field', () => {
    expect(flipSideToMove('8/8/8/8/8/8/8/8')).toBeNull();
  });
});

describe('buildPass', () => {
  it('builds the move_at_ply-ready payload with san "--"', () => {
    const pass = buildPass(START);
    expect(pass).not.toBeNull();
    expect(pass?.san).toBe('--');
    expect(pass?.from).toBeNull();
    expect(pass?.to).toBeNull();
    expect(pass?.fen.split(' ')[1]).toBe('b');
  });

  it('status is active mid-game and avoids chess.js rejections', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const pass = buildPass(fen);
    expect(pass?.status).toBe('active');
  });
});
