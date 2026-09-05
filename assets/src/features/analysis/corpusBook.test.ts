import { describe, expect, it } from 'vitest';
import {
  corpusContinuationsFor,
  mergeCorpusMoves,
  normalizeSan,
} from '@/features/analysis/corpusBook';
import type { OpeningBook } from '@/features/analysis/openings';
import type { BookMove } from '@/lib/api';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const move = (san: string, games: number): BookMove => ({
  move: san,
  games,
  white: Math.floor(games / 3),
  draw: Math.floor(games / 3),
  black: games - 2 * Math.floor(games / 3),
});

describe('normalizeSan', () => {
  it('strips trailing annotation glyphs', () => {
    expect(normalizeSan('Bg4?!')).toBe('Bg4');
    expect(normalizeSan('g4?')).toBe('g4');
    expect(normalizeSan('f3?!')).toBe('f3');
    expect(normalizeSan('Qxd1+')).toBe('Qxd1+');
    expect(normalizeSan('e4')).toBe('e4');
  });
});

describe('mergeCorpusMoves', () => {
  it('sums the annotated duplicates of one logical move', () => {
    const merged = mergeCorpusMoves([
      { move: 'Bg4', games: 10, white: 4, draw: 3, black: 3 },
      { move: 'Bg4?!', games: 2, white: 1, draw: 0, black: 1 },
    ]);
    expect(merged).toEqual([{ move: 'Bg4', games: 12, white: 5, draw: 3, black: 4 }]);
  });

  it('sorts by games desc, then SAN', () => {
    const merged = mergeCorpusMoves([move('Nf3', 3), move('d4', 40), move('c4', 40)]);
    expect(merged.map((m) => m.move)).toEqual(['c4', 'd4', 'Nf3']);
  });
});

describe('corpusContinuationsFor', () => {
  const book: OpeningBook = {
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': 'B00|King Pawn',
  };

  it('joins corpus SANs with legality and labels keyed children', () => {
    const rows = corpusContinuationsFor(
      book,
      START,
      mergeCorpusMoves([move('e4', 10), move('Nf3', 4)]),
    );

    expect(rows).toHaveLength(2);
    const e4 = rows.find((row) => row.san === 'e4');
    expect(e4).toMatchObject({ from: 'e2', to: 'e4', opening: { eco: 'B00', name: 'King Pawn' } });
    expect(e4?.stats.games).toBe(10);
    expect(rows.find((row) => row.san === 'Nf3')?.opening).toBeNull();
  });

  it('matches annotated corpus SANs to clean legal SANs', () => {
    const rows = corpusContinuationsFor(book, START, mergeCorpusMoves([move('e4?!', 7)]));
    expect(rows.map((row) => row.san)).toEqual(['e4']);
    expect(rows[0].stats.games).toBe(7);
  });

  it('drops rows that are not legal from the position', () => {
    const rows = corpusContinuationsFor(
      book,
      START,
      mergeCorpusMoves([move('Nh3', 1), move('Qh5', 9)]),
    );
    // Qh5 is blocked from the start position; Nh3 is legal.
    expect(rows.map((row) => row.san)).toEqual(['Nh3']);
  });

  it('is empty for null positions, empty input, and a null book labels nothing', () => {
    expect(corpusContinuationsFor(book, null, mergeCorpusMoves([move('e4', 1)]))).toEqual([]);
    expect(corpusContinuationsFor(book, START, [])).toEqual([]);
    const rows = corpusContinuationsFor(null, START, mergeCorpusMoves([move('e4', 1)]));
    expect(rows[0].opening).toBeNull();
  });
});
