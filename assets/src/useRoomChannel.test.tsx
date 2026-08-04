import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import type { PropsWithChildren } from 'react'
import { useRoomChannel } from './useRoomChannel'
import roomReducer from './store/room'
import type { Op } from './protocol/ops'
import type { Channel, ChannelState } from 'phoenix'

type Handler = (response?: unknown) => void | Promise<void>

class FakeChannel implements Channel {
  handlers = new Map<string, Handler[]>()
  pushes: { event: string; payload: unknown }[] = []
  joined = false
  joinReturn: { ops: Op[] } = { ops: [] }
  joinReceives = new Map<string, Handler>()
  state = 'joined' as ChannelState
  topic = 'room:test'

  onMessage(_event: string, payload: unknown) {
    return payload
  }

  onClose(_callback: (payload: unknown, ref: unknown, joinRef: unknown) => void) {
    return 1
  }

  onError(_callback: (reason?: unknown) => void) {
    return 1
  }

  on(event: string, handler: Handler) {
    const existing = this.handlers.get(event) ?? []
    this.handlers.set(event, [...existing, handler])
    return 1
  }

  off(_event: string) {}

  emit(event: string, payload: unknown) {
    for (const handler of this.handlers.get(event) ?? []) handler(payload)
    return this
  }

  join() {
    this.joined = true
    const push = {
      receive: (event: string, handler: Handler) => {
        this.joinReceives.set(event, handler)
        if (event === 'ok') {
          queueMicrotask(() => handler(this.joinReturn))
        }
        return push
      },
    }
    return push as never
  }

  leave() {
    this.joined = false
    return { receive: vi.fn() } as never
  }

  push(event: string, payload: unknown) {
    this.pushes.push({ event, payload })
    return { receive: vi.fn() } as never
  }
}

type TestStore = ReturnType<typeof makeStore>

function makeStore() {
  return configureStore({ reducer: { room: roomReducer } })
}

function wrapper(store: TestStore) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>
  }
}

describe('useRoomChannel', () => {
  let channel: FakeChannel
  let store: TestStore

  beforeEach(() => {
    channel = new FakeChannel()
    store = makeStore()
  })

  it('joins the room topic and replays ops into the store', async () => {
    const ops: Op[] = [
      {
        seq: 1,
        author: 'profile-1',
        ts: '2026-01-01T00:00:00Z',
        type: 'move_at_ply',
        payload: { ply: 1, san: 'e4' },
      },
    ]
    channel.joinReturn = { ops }

    const { result } = renderHook(() => useRoomChannel('room-a', () => channel), {
      wrapper: wrapper(store),
    })

    await waitFor(() => expect(result.current.joined).toBe(true))
    expect(store.getState().room.ops).toEqual(ops)
  })

  it('dispatches new_op echoes into the store', async () => {
    renderHook(() => useRoomChannel('room-a', () => channel), {
      wrapper: wrapper(store),
    })

    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'move_at_ply',
      payload: { ply: 1, san: 'e4' },
    }

    act(() => channel.emit('new_op', op))

    expect(store.getState().room.ops).toEqual([op])
  })

  it('sendOp pushes to the channel without applying locally', () => {
    const { result } = renderHook(() => useRoomChannel('room-a', () => channel), {
      wrapper: wrapper(store),
    })

    act(() =>
      result.current.sendOp({ type: 'set_cursor', payload: { ply: 4 } }),
    )

    expect(channel.pushes).toEqual([
      { event: 'op', payload: { type: 'set_cursor', payload: { ply: 4 } } },
    ])
    expect(store.getState().room.ops).toEqual([])
  })

  it('tracks presence members on state and diff events', async () => {
    renderHook(() => useRoomChannel('room-a', () => channel), {
      wrapper: wrapper(store),
    })

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    )
    act(() =>
      channel.emit('presence_diff', {
        joins: { 'profile-2': { metas: [{ name: 'Swift Falcon 17' }] } },
        leaves: {},
      }),
    )

    await waitFor(() => {
      expect(store.getState().room.presence).toEqual({
        'profile-1': { id: 'profile-1', name: 'Brave Otter 42' },
        'profile-2': { id: 'profile-2', name: 'Swift Falcon 17' },
      })
    })
  })

  it('cleans up: leaves the channel and clears the room', () => {
    const { unmount } = renderHook(() => useRoomChannel('room-a', () => channel), {
      wrapper: wrapper(store),
    })

    unmount()

    expect(channel.joined).toBe(false)
    expect(store.getState().room).toEqual({ slug: null, ops: [], presence: {} })
  })
})
