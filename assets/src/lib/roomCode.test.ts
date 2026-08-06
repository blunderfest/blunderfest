import { describe, expect, it } from 'vitest';
import { generateRoomCode, normalizeRoomCode, validRoomCode } from '@/lib/roomCode';

describe('generateRoomCode', () => {
  it('returns a 5-character code from the unambiguous alphabet', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{5}$/);
  });

  it('produces different codes across calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('normalizeRoomCode', () => {
  it('lowercases and strips non-alphanumeric characters', () => {
    expect(normalizeRoomCode(' AbC-1_2.3! ')).toBe('abc123');
  });

  it('returns an empty string for garbage input', () => {
    expect(normalizeRoomCode('!!!')).toBe('');
  });
});

describe('validRoomCode', () => {
  it('accepts 5-character codes from the unambiguous alphabet', () => {
    expect(validRoomCode('abcde')).toBe(true);
    expect(validRoomCode('kjhkj')).toBe(true);
    expect(validRoomCode('23459')).toBe(true);
  });

  it('rejects wrong lengths', () => {
    expect(validRoomCode('')).toBe(false);
    expect(validRoomCode('abcd')).toBe(false);
    expect(validRoomCode('kjhkjhkjhkj')).toBe(false);
  });

  it('rejects characters outside the unambiguous alphabet', () => {
    expect(validRoomCode('abc12')).toBe(false);
    expect(validRoomCode('ilove')).toBe(false);
    expect(validRoomCode('ABCDE')).toBe(false);
  });
});
