import { configureStore } from '@reduxjs/toolkit';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRoomChannel } from '@/features/room/useRoomChannel';
import type { Op } from '@/protocol/ops';
import roomReducer from '@/store/room';
import { FakeChannel } from '@/test/fakeChannel';

type TestStore = ReturnType<typeof makeStore>;

function makeStore() {
  return configureStore({ reducer: { room: roomReducer } });
}

function wrapper(store: TestStore) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useRoomChannel', () => {
  let channel: FakeChannel;
  let channelFactory: () => FakeChannel;
  let store: TestStore;

  beforeEach(() => {
    channel = new FakeChannel();
    channelFactory = () => channel;
    store = makeStore();
  });

  it('joins the room topic and replays ops into the store', async () => {
    const ops: Op[] = [
      {
        seq: 1,
        author: 'profile-1',
        ts: '2026-01-01T00:00:00Z',
        type: 'move_at_ply',
        payload: { ply: 1, san: 'e4' },
      },
    ];
    channel.joinReturn = { ops };

    const { result } = renderHook(() => useRoomChannel('room-a', channelFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() => expect(result.current.joined).toBe(true));
    expect(store.getState().room.ops).toEqual(ops);
  });

  it('dispatches new_op echoes into the store', async () => {
    renderHook(() => useRoomChannel('room-a', channelFactory), {
      wrapper: wrapper(store),
    });

    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'move_at_ply',
      payload: { ply: 1, san: 'e4' },
    };
    act(() => channel.emit('new_op', op));

    await waitFor(() => expect(store.getState().room.ops).toEqual([op]));
  });

  it('sendOp pushes to the channel without applying locally', async () => {
    const { result } = renderHook(() => useRoomChannel('room-a', channelFactory), {
      wrapper: wrapper(store),
    });

    act(() =>
      result.current.sendOp({
        type: 'set_cursor',
        payload: { node_id: 3 },
      }),
    );

    expect(channel.pushes).toEqual([
      { event: 'op', payload: { type: 'set_cursor', payload: { node_id: 3 } } },
    ]);
    expect(store.getState().room.ops).toEqual([]);
  });

  it('tracks presence members on state and diff events', async () => {
    const { result } = renderHook(() => useRoomChannel('room-a', channelFactory), {
      wrapper: wrapper(store),
    });

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );
    act(() =>
      channel.emit('presence_diff', {
        joins: { 'profile-2': { metas: [{ name: 'Swift Falcon 17' }] } },
        leaves: {},
      }),
    );

    await waitFor(() => {
      expect(store.getState().room.presence).toEqual({
        'profile-1': { id: 'profile-1', name: 'Brave Otter 42' },
        'profile-2': { id: 'profile-2', name: 'Swift Falcon 17' },
      });
    });
    expect(result.current.presence).toEqual([
      { id: 'profile-1', name: 'Brave Otter 42' },
      { id: 'profile-2', name: 'Swift Falcon 17' },
    ]);
  });

  it('cleans up: leaves the channel and clears the room', () => {
    const { unmount } = renderHook(() => useRoomChannel('room-a', channelFactory), {
      wrapper: wrapper(store),
    });

    unmount();

    expect(channel.joined).toBe(false);
    expect(store.getState().room).toEqual({ slug: null, ops: [], presence: {}, game: null });
  });

  it('rebuilds the game from a set_game op in the join payload', async () => {
    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_game',
      payload: {
        tree: {
          headers: { White: 'Alice' },
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
    };
    channel.joinReturn = { ops: [op] };

    renderHook(() => useRoomChannel('room-a', channelFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() => expect(store.getState().room.game).not.toBeNull());
    expect(store.getState().room.game?.headers.White).toBe('Alice');
  });

  it('sets the game from a set_game op echo', async () => {
    renderHook(() => useRoomChannel('room-a', channelFactory), {
      wrapper: wrapper(store),
    });

    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_game',
      payload: {
        tree: {
          headers: { White: 'Bob' },
          result: '1-0',
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
    };
    act(() => channel.emit('new_op', op));

    await waitFor(() => expect(store.getState().room.game?.headers.White).toBe('Bob'));
  });
});
