import { describe, it, expect } from 'vitest'
import { generateRoomCode, normalizeRoomCode } from '@/lib/roomCode'

describe('generateRoomCode', () => {
  it('returns a 5-character code from the unambiguous alphabet', () => {
    const code = generateRoomCode()
    expect(code).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{5}$/)
  })

  it('produces different codes across calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRoomCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('normalizeRoomCode', () => {
  it('lowercases and strips non-alphanumeric characters', () => {
    expect(normalizeRoomCode(' AbC-1_2.3! ')).toBe('abc123')
  })

  it('returns an empty string for garbage input', () => {
    expect(normalizeRoomCode('!!!')).toBe('')
  })
})
