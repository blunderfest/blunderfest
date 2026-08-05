import { describe, it, expect } from 'vitest'
import { isLightSquare, parseFen, pieceGlyph, squareName } from './board'

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('parseFen', () => {
  it('parses the start position', () => {
    const position = parseFen(start)

    expect(position[0]).toEqual({ color: 'b', kind: 'r' })
    expect(position[7]).toEqual({ color: 'b', kind: 'r' })
    expect(position[4]).toEqual({ color: 'b', kind: 'k' })
    expect(position[63]).toEqual({ color: 'w', kind: 'r' })
    expect(position[60]).toEqual({ color: 'w', kind: 'k' })
    expect(position[8]).toEqual({ color: 'b', kind: 'p' })
    expect(position[55]).toEqual({ color: 'w', kind: 'p' })
    expect(position[27]).toBeNull()
  })

  it('parses a mid-game FEN with empty ranks', () => {
    const position = parseFen('4k3/8/4N3/8/4N3/8/8/4K3 w - - 0 1')

    expect(position[20]).toEqual({ color: 'w', kind: 'n' })
    expect(position[36]).toEqual({ color: 'w', kind: 'n' })
    expect(position[60]).toEqual({ color: 'w', kind: 'k' })
    expect(position[4]).toEqual({ color: 'b', kind: 'k' })
    expect(position.filter(Boolean)).toHaveLength(4)
  })
})

describe('squareName', () => {
  it('maps index to algebraic squares', () => {
    expect(squareName(0)).toBe('a8')
    expect(squareName(4)).toBe('e8')
    expect(squareName(28)).toBe('e5')
    expect(squareName(63)).toBe('h1')
  })
})

describe('isLightSquare', () => {
  it('follows the standard checkerboard', () => {
    expect(isLightSquare(0)).toBe(true)
    expect(isLightSquare(7)).toBe(false)
    expect(isLightSquare(63)).toBe(true)
    expect(isLightSquare(60)).toBe(false)
  })
})

describe('pieceGlyph', () => {
  it('maps every piece kind and color to a glyph', () => {
    expect(pieceGlyph('w', 'k')).toBe('♔')
    expect(pieceGlyph('b', 'k')).toBe('♚')
    expect(pieceGlyph('w', 'p')).toBe('♙')
    expect(pieceGlyph('b', 'p')).toBe('♟')
  })
})
