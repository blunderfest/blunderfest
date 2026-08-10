import { describe, expect, it } from 'vitest';
import { legalMovesFor } from '@/features/analysis/legalMoves';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('legalMovesFor', () => {
  it('returns 20 moves for the start position with resulting fens', () => {
    const moves = legalMovesFor(START);
    expect(moves).toHaveLength(20);
    const e4 = moves.find((move) => move.from === 'e2' && move.to === 'e4');
    expect(e4?.san).toBe('e4');
    expect(e4?.fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(e4?.status).toBe('active');
  });

  it('includes all promotion variants', () => {
    const promos = legalMovesFor('8/2P5/8/8/8/6k1/8/4K3 w - - 0 1').filter(
      (move) => move.from === 'c7',
    );
    expect(promos.map((move) => move.promotion).sort()).toEqual(['b', 'n', 'q', 'r']);
  });

  it('flags checkmate', () => {
    // Fool's mate: 1. f3 e5 2. g4?? Qh4#
    const moves = legalMovesFor('rnbqkbnr/pppp1ppp/8/8/4p1P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2');
    const mate = moves.find((move) => move.san === 'Qh4#');
    expect(mate?.status).toBe('checkmate');
  });

  it('returns an empty list for invalid fens', () => {
    expect(legalMovesFor('garbage')).toEqual([]);
  });
});
