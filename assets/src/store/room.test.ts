import { describe, it, expect } from 'vitest'
import roomReducer, { enterRoom, leaveRoom, applyOp, replayOps, joinMember, leaveMember } from './room'
import type { Op, SetGameOp } from '../protocol/ops'

function moveOp(seq: number): Op {
  return {
    seq,
    author: 'author-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'move_at_ply',
    payload: { ply: 1, san: 'e4' },
  }
}

function cursorOp(seq: number): Op {
  return {
    seq,
    author: 'author-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'set_cursor',
    payload: { ply: 3 },
  }
}

function setGameOp(seq: number, white: string): SetGameOp {
  return {
    seq,
    author: 'author-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'set_game',
    payload: {
      tree: {
        headers: { White: white },
        result: '*',
        setup: null,
        mainline_ply_count: 0,
        node_count: 1,
        root: {
          id: 0,
          ply: 0,
          san: null,
          from: null,
          to: null,
          promotion: null,
          comment: null,
          nags: [],
          status: 'active',
          fen: null,
          children: [],
        },
      },
    },
  }
}

describe('room slice', () => {
  it('starts empty', () => {
    const state = roomReducer(undefined, { type: '@@init' })
    expect(state).toEqual({ slug: null, ops: [], presence: {}, game: null })
  })

  it('enterRoom sets the slug and clears ops, presence and game', () => {
    const state = roomReducer(
      {
        slug: 'old',
        ops: [moveOp(1)],
        presence: { 'author-1': { id: 'author-1', name: 'Brave Otter 42' } },
        game: setGameOp(1, 'Alice').payload.tree,
      },
      enterRoom({ slug: 'room-123' }),
    )
    expect(state).toEqual({ slug: 'room-123', ops: [], presence: {}, game: null })
  })

  it('leaveRoom clears everything', () => {
    const state = roomReducer(
      {
        slug: 'room-123',
        ops: [moveOp(1)],
        presence: { 'author-1': { id: 'author-1', name: 'Brave Otter 42' } },
        game: setGameOp(1, 'Alice').payload.tree,
      },
      leaveRoom(),
    )
    expect(state).toEqual({ slug: null, ops: [], presence: {}, game: null })
  })

  it('applyOp appends ops with increasing seq', () => {
    let state = roomReducer(undefined, applyOp(moveOp(1)))
    state = roomReducer(state, applyOp(moveOp(2)))
    expect(state.ops.map((o) => o.seq)).toEqual([1, 2])
  })

  it('applyOp ignores an op with a stale or equal seq', () => {
    let state = roomReducer(undefined, applyOp(moveOp(2)))
    state = roomReducer(state, applyOp(moveOp(2)))
    state = roomReducer(state, applyOp(moveOp(1)))
    expect(state.ops.map((o) => o.seq)).toEqual([2])
  })

  it('replayOps replaces ops and sorts by seq', () => {
    let state = roomReducer(undefined, applyOp(moveOp(3)))
    state = roomReducer(state, replayOps([cursorOp(2), moveOp(1)]))
    expect(state.ops.map((o) => o.seq)).toEqual([1, 2])
  })

  it('sets the game from a set_game op', () => {
    const op = setGameOp(1, 'Alice')
    const state = roomReducer(undefined, applyOp(op))
    expect(state.game).toEqual(op.payload.tree)
  })

  it('the last set_game op wins', () => {
    const first = setGameOp(1, 'Alice')
    const second = setGameOp(2, 'Bob')
    let state = roomReducer(undefined, applyOp(first))
    state = roomReducer(state, applyOp(second))
    expect(state.game?.headers['White']).toBe('Bob')
  })

  it('rebuilds the game from replayed ops', () => {
    const gameOp = setGameOp(3, 'Alice')
    const state = roomReducer(undefined, replayOps([gameOp, moveOp(1)]))
    expect(state.game).toEqual(gameOp.payload.tree)
  })

  it('tracks presence members', () => {
    const member = { id: 'author-1', name: 'Brave Otter 42' }
    let state = roomReducer(undefined, joinMember(member))
    expect(state.presence).toEqual({ 'author-1': member })
    state = roomReducer(state, leaveMember({ id: 'author-1' }))
    expect(state.presence).toEqual({})
  })
})
