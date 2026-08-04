import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import RoomView from './RoomView'
import roomReducer from './store/room'
import { FakeChannel } from './test/fakeChannel'
import type { Op } from './protocol/ops'

function makeStore() {
  return configureStore({ reducer: { room: roomReducer } })
}

const moveOp: Op = {
  seq: 1,
  author: 'profile-1',
  ts: '2026-01-01T00:00:00Z',
  type: 'move_at_ply',
  payload: { ply: 1, san: 'e4' },
}

describe('RoomView', () => {
  let channel: FakeChannel

  beforeEach(() => {
    channel = new FakeChannel()
  })

  function renderRoom(slug = 'abc12', onLeave = vi.fn()) {
    const store = makeStore()
    const view = render(
      <Provider store={store}>
        <RoomView slug={slug} onLeave={onLeave} channelFactory={() => channel} />
      </Provider>,
    )
    return { store, onLeave, view }
  }

  it('shows the room code and joins the channel', async () => {
    renderRoom()
    expect(screen.getByText('ABC12')).toBeInTheDocument()
    expect(channel.joined).toBe(true)
    expect(screen.getByText('Copy')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Connecting…')).not.toBeInTheDocument())
  })

  it('shows joining members from presence diffs', async () => {
    renderRoom()
    await waitFor(() => expect(screen.queryByText('Connecting…')).not.toBeInTheDocument())
    act(() =>
      channel.emit('presence_diff', {
        joins: { 'profile-2': { metas: [{ name: 'Swift Falcon 17' }] } },
        leaves: {},
      }),
    )
    expect(await screen.findByText('Swift Falcon 17')).toBeInTheDocument()
  })

  it('lists ops replayed on join with author names', async () => {
    channel.joinReturn = { ops: [moveOp] }
    renderRoom()
    expect(await screen.findByText('1. e4')).toBeInTheDocument()
  })

  it('appends echoed ops from the channel', async () => {
    renderRoom()
    await waitFor(() => expect(screen.queryByText('Connecting…')).not.toBeInTheDocument())
    act(() => channel.emit('new_op', moveOp))
    expect(await screen.findByText('1. e4')).toBeInTheDocument()
  })

  it('leaves the room when clicking leave', () => {
    const { onLeave } = renderRoom()
    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
