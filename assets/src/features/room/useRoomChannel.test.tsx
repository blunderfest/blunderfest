import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRoomChannel } from '@/features/room/useRoomChannel';
import type { Op } from '@/protocol/ops';
import type { initialRoomContext } from '@/store/roomStore';
import { FakeChannel } from '@/test/fakeChannel';

/** The current room context from the hook's store (null until it exists). */
function ctx(result: { current: { store: { getSnapshot: () => { context: unknown } } | null } }) {
  const store = result.current.store;
  if (store === null) {
    throw new Error('expected a room store');
  }
  return store.getSnapshot().context as ReturnType<typeof initialRoomContext>;
}

describe('useRoomChannel', () => {
  let channel: FakeChannel;
  let channelFactory: (topic: string, params?: Record<string, string>) => FakeChannel;

  beforeEach(() => {
    channel = new FakeChannel();
    channelFactory = (_topic: string, params: Record<string, string> = {}) => {
      channel.joinParams = params;
      return channel;
    };
  });

  it('exposes the reason when the join is rejected', async () => {
    channel.joinError = { reason: 'invalid_code' };

    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));

    await waitFor(() => expect(result.current.joinError).toBe('invalid_code'));
    expect(result.current.joined).toBe(false);
  });

  it('retries room_not_found once before showing the error', async () => {
    // A freshly created room can lag behind the join across the cluster;
    // the first attempt fails, the retry succeeds.
    const channels: FakeChannel[] = [];
    const freshFactory = () => {
      const next = new FakeChannel();
      if (channels.length === 0) {
        next.joinError = { reason: 'room_not_found' };
      }
      channels.push(next);
      return next;
    };

    const { result } = renderHook(() => useRoomChannel('room-a', null, null, freshFactory));

    await waitFor(() => expect(result.current.joined).toBe(true), { timeout: 2000 });
    expect(channels).toHaveLength(2);
    expect(result.current.joinError).toBeNull();
  });

  it('shows the not-found error when the retry also fails', async () => {
    channel.joinError = { reason: 'room_not_found' };

    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));

    await waitFor(() => expect(result.current.joinError).toBe('room_not_found'), {
      timeout: 2000,
    });
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

    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));

    await waitFor(() => expect(result.current.joined).toBe(true));
    expect(ctx(result).ops).toEqual(ops);
  });

  it('passes the profile id and name as join params', async () => {
    renderHook(() => useRoomChannel('room-a', 'profile-1', 'Brave Otter 42', channelFactory));

    await waitFor(() => expect(channel.joined).toBe(true));
    expect(channel.joinParams).toEqual({ profile_id: 'profile-1', name: 'Brave Otter 42' });
  });

  it('joins without params when no profile is available, then rejoins with it once it loads', async () => {
    const { rerender } = renderHook(
      ({ id, name }: { id: string | null; name: string | null }) =>
        useRoomChannel('room-a', id, name, channelFactory),
      { initialProps: { id: null as string | null, name: null as string | null } },
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
    renderHook(() => useRoomChannel('room-a', 'profile-1', null, channelFactory));

    await waitFor(() => expect(channel.joined).toBe(true));
    expect(channel.joinParams).toEqual({ profile_id: 'profile-1' });
  });

  function moveOp(seq: number): Op {
    return {
      seq,
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
  }

  it('sends new_op echoes into the store', async () => {
    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));
    await waitFor(() => expect(result.current.store).not.toBeNull());

    const op = moveOp(1);
    act(() => channel.emit('new_op', op));

    await waitFor(() => expect(ctx(result).ops).toEqual([op]));
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
    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));

    await waitFor(() => expect(ctx(result).ops).toHaveLength(1));

    act(() => channel.emit('new_op', cursorOp(2)));
    act(() => channel.emit('new_op', cursorOp(2)));
    act(() => channel.emit('new_op', cursorOp(1)));

    expect(ctx(result).ops.map((op) => op.seq)).toEqual([1, 2]);
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

    const { result } = renderHook(() => useRoomChannel('room-a', null, null, freshFactory));

    await waitFor(() => expect(ctx(result).ops).toHaveLength(2));

    // In-order echoes apply normally.
    act(() => channels[0].emit('new_op', cursorOp(3)));
    expect(ctx(result).ops.map((op) => op.seq)).toEqual([1, 2, 3]);

    // A gap (seq 5 while seq 4 is missing) drops the echo and resyncs:
    // the old channel is left, a fresh one joins, and the replayed log
    // replaces the store wholesale.
    act(() => channels[0].emit('new_op', cursorOp(5)));

    await waitFor(() => expect(channels).toHaveLength(2));
    expect(channels[0].joined).toBe(false);
    expect(channels[1].joined).toBe(true);
    expect(ctx(result).ops.map((op) => op.seq)).toEqual([1, 2]);
  });

  it('sendOp pushes to the channel without applying locally', async () => {
    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));
    await waitFor(() => expect(result.current.store).not.toBeNull());

    act(() =>
      result.current.sendOp({
        type: 'set_cursor',
        payload: { node_id: 3 },
      }),
    );

    expect(channel.pushes).toEqual([
      { event: 'op', payload: { type: 'set_cursor', payload: { node_id: 3 } } },
    ]);
    expect(ctx(result).ops).toEqual([]);
  });

  it('tracks presence members on state and diff events', async () => {
    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));
    await waitFor(() => expect(result.current.store).not.toBeNull());

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
      expect(ctx(result).presence).toEqual({
        'profile-1': { id: 'profile-1', name: 'Brave Otter 42' },
        'profile-2': { id: 'profile-2', name: 'Swift Falcon 17' },
      });
    });
  });

  it('does not duplicate a member who appears in both the state and a diff', async () => {
    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));
    await waitFor(() => expect(result.current.store).not.toBeNull());

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
      expect(ctx(result).presence).toEqual({
        'profile-1': { id: 'profile-1', name: 'Brave Otter 42' },
      }),
    );
  });

  it('keeps a member whose other tab leaves (one profile, two presences)', async () => {
    // Two tabs share one presence key (the profile id). The diff for one
    // tab closing carries the key in `leaves` with the departed meta — the
    // member is gone only when the key's last meta is gone. Phoenix's
    // Presence tracks the metas; we sync its authoritative list.
    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));
    await waitFor(() => expect(result.current.store).not.toBeNull());

    // Metas carry phx_ref like the real server (syncDiff matches on it).
    act(() =>
      channel.emit('presence_state', {
        'profile-1': {
          metas: [
            { name: 'Brave Otter 42', phx_ref: 'tab-a' },
            { name: 'Brave Otter 42', phx_ref: 'tab-b' },
          ],
        },
      }),
    );
    act(() =>
      channel.emit('presence_diff', {
        joins: {},
        leaves: { 'profile-1': { metas: [{ name: 'Brave Otter 42', phx_ref: 'tab-b' }] } },
      }),
    );

    await waitFor(() =>
      expect(ctx(result).presence).toEqual({
        'profile-1': { id: 'profile-1', name: 'Brave Otter 42' },
      }),
    );
  });

  it('removes members on presence leaves', async () => {
    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));
    await waitFor(() => expect(result.current.store).not.toBeNull());

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

    await waitFor(() => expect(ctx(result).presence).toEqual({}));
  });

  it('ignores events from a superseded channel after a rejoin', async () => {
    const first = new FakeChannel();
    const second = new FakeChannel();
    let created = 0;
    const factory = (_topic: string, params: Record<string, string> = {}) => {
      created += 1;
      const ch = created === 1 ? first : second;
      ch.joinParams = params;
      return ch;
    };
    const { result, rerender } = renderHook(
      ({ id, name }: { id: string | null; name: string | null }) =>
        useRoomChannel('room-a', id, name, factory),
      { initialProps: { id: null as string | null, name: null as string | null } },
    );

    await waitFor(() => expect(first.joined).toBe(true));
    rerender({ id: 'profile-1', name: 'Brave Otter 42' });
    await waitFor(() => expect(second.joined).toBe(true));
    await waitFor(() => expect(result.current.store).not.toBeNull());

    // The rejoin's presence state arrives first (real server behavior —
    // phoenix's Presence queues bare diffs until the state lands).
    act(() => second.emit('presence_state', {}));

    act(() =>
      first.emit('presence_diff', {
        joins: { ghost: { metas: [{ name: 'Ghost 00' }] } },
        leaves: {},
      }),
    );
    await waitFor(() => expect(ctx(result).presence).toEqual({}));

    act(() =>
      second.emit('presence_diff', {
        joins: { 'profile-1': { metas: [{ name: 'Brave Otter 42' }] } },
        leaves: {},
      }),
    );
    await waitFor(() =>
      expect(ctx(result).presence).toEqual({
        'profile-1': { id: 'profile-1', name: 'Brave Otter 42' },
      }),
    );
  });

  it('cleans up: leaves the channel on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useRoomChannel('room-a', null, null, channelFactory),
    );

    // A store existed while mounted.
    expect(result.current.store).not.toBeNull();
    unmount();

    expect(channel.joined).toBe(false);
  });

  it('dispatches the role map from the join reply', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner', 'profile-2': 'collaborator' } };

    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));

    await waitFor(() =>
      expect(ctx(result).roles).toEqual({
        'profile-1': 'owner',
        'profile-2': 'collaborator',
      }),
    );
  });

  it('stores the read_only flag from the join reply (false when absent)', async () => {
    channel.joinReturn = { ops: [], read_only: true };

    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));

    await waitFor(() => expect(ctx(result).readOnly).toBe(true));
  });

  it('updates roles on role_update events', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner', 'profile-2': 'viewer' } };

    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));

    await waitFor(() => expect(ctx(result).roles['profile-2']).toBe('viewer'));
    act(() => channel.emit('role_update', { member_id: 'profile-2', role: 'collaborator' }));

    await waitFor(() => expect(ctx(result).roles['profile-2']).toBe('collaborator'));
  });

  it('sendRole pushes a set_role event', async () => {
    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));

    act(() => result.current.sendRole('profile-2', 'collaborator'));

    expect(channel.pushes).toEqual([
      { event: 'set_role', payload: { member_id: 'profile-2', role: 'collaborator' } },
    ]);
  });

  function gameOp(seq: number, gameId: string, white: string): Op {
    return {
      seq,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_game',
      payload: {
        game_id: gameId,
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
    };
  }

  it('rebuilds the game from a set_game op in the join payload', async () => {
    channel.joinReturn = { ops: [gameOp(1, 'game-1', 'Alice')] };

    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));

    await waitFor(() => expect(ctx(result).games['game-1']).toBeDefined());
    expect(ctx(result).games['game-1']?.headers.White).toBe('Alice');
  });

  it('sets the game from a set_game op echo', async () => {
    const { result } = renderHook(() => useRoomChannel('room-a', null, null, channelFactory));
    await waitFor(() => expect(result.current.store).not.toBeNull());

    act(() => channel.emit('new_op', gameOp(1, 'game-2', 'Bob')));

    await waitFor(() => expect(ctx(result).games['game-2']?.headers.White).toBe('Bob'));
  });
});
