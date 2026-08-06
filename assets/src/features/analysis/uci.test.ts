import { describe, expect, it } from 'vitest';
import {
  bestMoveSquares,
  evalLabel,
  parseBestMove,
  parseInfoLine,
  whiteEval,
  whiteShare,
} from '@/features/analysis/uci';

describe('parseInfoLine', () => {
  it('extracts depth, score and pv from a full info line', () => {
    const info = parseInfoLine(
      'info depth 15 seldepth 20 multipv 1 score cp 32 nodes 123456 nps 800000 hashfull 12 tbhits 0 time 250 pv e2e4 e7e5 g1f3',
    );
    expect(info).toEqual({
      depth: 15,
      score: { type: 'cp', cp: 32 },
      pv: ['e2e4', 'e7e5', 'g1f3'],
    });
  });

  it('parses a mate score', () => {
    const info = parseInfoLine('info depth 22 score mate 3 pv d8h4 g3h4 h7h5');
    expect(info?.score).toEqual({ type: 'mate', mate: 3 });
    expect(info?.pv[0]).toBe('d8h4');
  });

  it('returns null for non-info lines', () => {
    expect(parseInfoLine('bestmove e2e4')).toBeNull();
    expect(parseInfoLine('readyok')).toBeNull();
  });

  it('returns nulls for info lines without a score', () => {
    expect(parseInfoLine('info depth 1 nodes 10')).toEqual({ depth: 1, score: null, pv: [] });
  });
});

describe('parseBestMove', () => {
  it('extracts the move', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
  });

  it('returns null for non-bestmove lines', () => {
    expect(parseBestMove('info depth 5')).toBeNull();
  });
});

describe('bestMoveSquares', () => {
  it('maps a uci move to squares', () => {
    expect(bestMoveSquares('e2e4')).toEqual({ from: 'e2', to: 'e4' });
  });

  it('ignores promotion suffixes', () => {
    expect(bestMoveSquares('e7e8q')).toEqual({ from: 'e7', to: 'e8' });
  });

  it('returns null for "(none)"', () => {
    expect(bestMoveSquares('(none)')).toBeNull();
  });
});

describe('whiteEval', () => {
  it('keeps the score when white is to move', () => {
    expect(whiteEval({ type: 'cp', cp: -45 }, 'w')).toEqual({ type: 'cp', cp: -45 });
  });

  it('flips the score when black is to move', () => {
    expect(whiteEval({ type: 'cp', cp: 80 }, 'b')).toEqual({ type: 'cp', cp: -80 });
    expect(whiteEval({ type: 'mate', mate: 2 }, 'b')).toEqual({ type: 'mate', moves: -2 });
    expect(whiteEval({ type: 'mate', mate: -3 }, 'b')).toEqual({ type: 'mate', moves: 3 });
  });
});

describe('evalLabel', () => {
  it('formats centipawns with a sign', () => {
    expect(evalLabel({ type: 'cp', cp: 125 })).toBe('+1.25');
    expect(evalLabel({ type: 'cp', cp: -80 })).toBe('-0.80');
    expect(evalLabel({ type: 'cp', cp: 0 })).toBe('+0.00');
  });

  it('formats mates', () => {
    expect(evalLabel({ type: 'mate', moves: 3 })).toBe('M3');
    expect(evalLabel({ type: 'mate', moves: -2 })).toBe('-M2');
  });
});

describe('whiteShare', () => {
  it('is balanced without an eval', () => {
    expect(whiteShare(null)).toBe(50);
  });

  it('maps centipawns onto the bar', () => {
    expect(whiteShare({ type: 'cp', cp: 0 })).toBe(50);
    expect(whiteShare({ type: 'cp', cp: 100 })).toBe(56);
    expect(whiteShare({ type: 'cp', cp: -100 })).toBe(44);
  });

  it('clamps extreme values', () => {
    expect(whiteShare({ type: 'cp', cp: 5000 })).toBe(97);
    expect(whiteShare({ type: 'cp', cp: -5000 })).toBe(3);
  });

  it('puts mates at the extremes', () => {
    expect(whiteShare({ type: 'mate', moves: 1 })).toBe(98);
    expect(whiteShare({ type: 'mate', moves: -1 })).toBe(2);
  });
});
