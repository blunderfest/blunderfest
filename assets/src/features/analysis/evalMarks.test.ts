import { describe, expect, it } from 'vitest';
import { evalText, moveMark, toCentipawns } from '@/features/analysis/evalMarks';

describe('toCentipawns', () => {
  it('maps results to terminal values', () => {
    expect(toCentipawns({ result: '1-0' })).toBe(10_000);
    expect(toCentipawns({ result: '0-1' })).toBe(-10_000);
    expect(toCentipawns({ result: '1/2-1/2' })).toBe(0);
  });
});

describe('evalText', () => {
  it('renders the result for terminal positions', () => {
    expect(evalText({ result: '1-0' })).toBe('1-0');
    expect(evalText({ result: '0-1' })).toBe('0-1');
  });
});

describe('moveMark', () => {
  it('never flags the mating move as a blunder', () => {
    // White plays Qg7#: mate-in-1 before, the stored result after.
    expect(moveMark({ mate: 1 }, { result: '1-0' }, true)).toBeNull();
    // Black delivers fool's mate: mate-for-black before, 0-1 after.
    expect(moveMark({ mate: -1 }, { result: '0-1' }, false)).toBeNull();
  });

  it('still flags a blunder that throws away a forced mate', () => {
    // White had mate in 1 and played a quiet move instead (+0.2).
    expect(moveMark({ mate: 1 }, { cp: 20 }, true)).toBe('??');
  });
});
