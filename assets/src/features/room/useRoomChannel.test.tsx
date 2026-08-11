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
  let channelFactory: (topic: string, params?: Record<string, string>) => FakeChannel;
  let store: TestStore;

  beforeEach(() => {
    channel = new FakeChannel();
    channelFactory = (_topic: string, params: Record<string, string> = {}) => {
      channel.joinParams = params;
      return channel;
    };
    store = makeStore();
  });

  it('exposes the reason when the join is rejected', async () => {
    channel.joinError = { reason: 'room_not_found' };

    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() => expect(result.current.joinError).toBe('room_not_found'));
    expect(result.current.joined).toBe(false);
  });

  it('joins the room topic and replays ops into the store', async () => {
    const ops: Op[] = [
      {
        seq: 1,
        author: 'profile-1',
        ts: '2026-01-01T00:00:00Z',
        type: 'move_at_ply',
        payload: {
          game_id: 'game-1',
          ply: 1,
          san: 'e4',
          from: 'e2',
          to: 'e4',
          promotion: null,
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
          status: 'active',
        },
      },
    ];
    channel.joinReturn = { ops };

    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() => expect(result.current.joined).toBe(true));
    expect(store.getState().room.ops).toEqual(ops);
  });

  it('passes the profile id and name as join params', async () => {
    renderHook(() => useRoomChannel('room-a', 'profile-1', 'Brave Otter 42', channelFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() => expect(channel.joined).toBe(true));
    expect(channel.joinParams).toEqual({ profile_id: 'profile-1', name: 'Brave Otter 42' });
  });

  it('joins without params when no profile is available, then rejoins with it once it loads', async () => {
    const { rerender } = renderHook(
      ({ id, name }: { id: string | null; name: string | null }) =>
        useRoomChannel('room-a', id, name, channelFactory),
      {
        wrapper: wrapper(store),
        initialProps: { id: null as string | null, name: null as string | null },
      },
    );

    await waitFor(() => expect(channel.joined).toBe(true));
    expect(channel.joinParams).toEqual({});

    rerender({ id: 'profile-1', name: 'Brave Otter 42' });
    await waitFor(() =>
      expect(channel.joinParams).toEqual({ profile_id: 'profile-1', name: 'Brave Otter 42' }),
    );
    expect(channel.joined).toBe(true);
  });

  it('omits the name when only the profile id is known', async () => {
    renderHook(() => useRoomChannel('room-a', 'profile-1', null, channelFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() => expect(channel.joined).toBe(true));
    expect(channel.joinParams).toEqual({ profile_id: 'profile-1' });
  });

  it('dispatches new_op echoes into the store', async () => {
    renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'move_at_ply',
      payload: {
        game_id: 'game-1',
        ply: 1,
        san: 'e4',
        from: 'e2',
        to: 'e4',
        promotion: null,
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        status: 'active',
      },
    };
    act(() => channel.emit('new_op', op));

    await waitFor(() => expect(store.getState().room.ops).toEqual([op]));
  });

  function cursorOp(seq: number): Op {
    return {
      seq,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_cursor',
      payload: { node_id: seq },
    };
  }

  it('ignores stale or duplicate echoes', async () => {
    channel.joinReturn = { ops: [cursorOp(1)] };
    renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() => expect(store.getState().room.ops).toHaveLength(1));

    act(() => channel.emit('new_op', cursorOp(2)));
    act(() => channel.emit('new_op', cursorOp(2)));
    act(() => channel.emit('new_op', cursorOp(1)));

    expect(store.getState().room.ops.map((op) => op.seq)).toEqual([1, 2]);
  });

  it('resyncs by rejoining when an echo arrives with a seq gap', async () => {
    // A fresh channel per (re)join, so the rejoin is observable.
    const channels: FakeChannel[] = [];
    const freshFactory = () => {
      const next = new FakeChannel();
      next.joinReturn = { ops: [cursorOp(1), cursorOp(2)] };
      channels.push(next);
      return next;
    };

    renderHook(() => useRoomChannel('room-a', null, null, freshFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() => expect(store.getState().room.ops).toHaveLength(2));

    // In-order echoes apply normally.
    act(() => channels[0].emit('new_op', cursorOp(3)));
    expect(store.getState().room.ops.map((op) => op.seq)).toEqual([1, 2, 3]);

    // A gap (seq 5 while seq 4 is missing) drops the echo and resyncs:
    // the old channel is left, a fresh one joins, and the replayed log
    // replaces the store wholesale.
    act(() => channels[0].emit('new_op', cursorOp(5)));

    await waitFor(() => expect(channels).toHaveLength(2));
    expect(channels[0].joined).toBe(false);
    expect(channels[1].joined).toBe(true);
    expect(store.getState().room.ops.map((op) => op.seq)).toEqual([1, 2]);
  });

  it('sendOp pushes to the channel without applying locally', async () => {
    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
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
    renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
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
  });

  it('does not duplicate a member who appears in both the state and a diff', async () => {
    renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );
    act(() =>
      channel.emit('presence_diff', {
        joins: { 'profile-1': { metas: [{ name: 'Brave Otter 42' }] } },
        leaves: {},
      }),
    );

    await waitFor(() =>
      expect(store.getState().room.presence).toEqual({
        'profile-1': { id: 'profile-1', name: 'Brave Otter 42' },
      }),
    );
  });

  it('removes members on presence leaves', async () => {
    renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );
    act(() =>
      channel.emit('presence_diff', {
        joins: {},
        leaves: { 'profile-1': { metas: [{ name: 'Brave Otter 42' }] } },
      }),
    );

    await waitFor(() => expect(store.getState().room.presence).toEqual({}));
  });

  it('ignores events from a superseded channel after a rejoin', async () => {
    const first = new FakeChannel();
    const second = new FakeChannel();
    let created = 0;
    const factory = (_topic: string, params: Record<string, string> = {}) => {
      created += 1;
      const channel = created === 1 ? first : second;
      channel.joinParams = params;
      return channel;
    };
    const { rerender } = renderHook(
      ({ id, name }: { id: string | null; name: string | null }) =>
        useRoomChannel('room-a', id, name, factory),
      {
        wrapper: wrapper(store),
        initialProps: { id: null as string | null, name: null as string | null },
      },
    );

    await waitFor(() => expect(first.joined).toBe(true));
    rerender({ id: 'profile-1', name: 'Brave Otter 42' });
    await waitFor(() => expect(second.joined).toBe(true));

    act(() =>
      first.emit('presence_diff', {
        joins: { ghost: { metas: [{ name: 'Ghost 00' }] } },
        leaves: {},
      }),
    );
    await waitFor(() => expect(store.getState().room.presence).toEqual({}));

    act(() =>
      second.emit('presence_diff', {
        joins: { 'profile-1': { metas: [{ name: 'Brave Otter 42' }] } },
        leaves: {},
      }),
    );
    await waitFor(() =>
      expect(store.getState().room.presence).toEqual({
        'profile-1': { id: 'profile-1', name: 'Brave Otter 42' },
      }),
    );
  });

  it('cleans up: leaves the channel and clears the room', () => {
    const { unmount } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    unmount();

    expect(channel.joined).toBe(false);
    expect(store.getState().room).toEqual({
      slug: null,
      ops: [],
      presence: {},
      names: {},
      roles: {},
      games: {},
      lastPlayed: {},
      annotations: {},
      region: null,
      readOnly: false,
    });
  });

  it('dispatches the role map from the join reply', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner', 'profile-2': 'collaborator' } };

    renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() =>
      expect(store.getState().room.roles).toEqual({
        'profile-1': 'owner',
        'profile-2': 'collaborator',
      }),
    );
  });

  it('stores the read_only flag from the join reply (false when absent)', async () => {
    channel.joinReturn = { ops: [], read_only: true };

    renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() => expect(store.getState().room.readOnly).toBe(true));
  });

  it('updates roles on role_update events', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner', 'profile-2': 'viewer' } };

    renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() => expect(store.getState().room.roles['profile-2']).toBe('viewer'));
    act(() => channel.emit('role_update', { member_id: 'profile-2', role: 'collaborator' }));

    await waitFor(() => expect(store.getState().room.roles['profile-2']).toBe('collaborator'));
  });

  it('sendRole pushes a set_role event', async () => {
    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    act(() => result.current.sendRole('profile-2', 'collaborator'));

    expect(channel.pushes).toEqual([
      { event: 'set_role', payload: { member_id: 'profile-2', role: 'collaborator' } },
    ]);
  });

  it('rebuilds the game from a set_game op in the join payload', async () => {
    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_game',
      payload: {
        game_id: 'game-1',
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

    renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    await waitFor(() => expect(store.getState().room.games['game-1']).toBeDefined());
    expect(store.getState().room.games['game-1']?.headers.White).toBe('Alice');
  });

  it('sets the game from a set_game op echo', async () => {
    renderHook(() => useRoomChannel('room-a', null, null, channelFactory), {
      wrapper: wrapper(store),
    });

    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_game',
      payload: {
        game_id: 'game-2',
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

    await waitFor(() => expect(store.getState().room.games['game-2']?.headers.White).toBe('Bob'));
  });
});
