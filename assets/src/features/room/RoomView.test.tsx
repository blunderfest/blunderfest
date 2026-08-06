import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RoomView from '@/features/room/RoomView';
import type { GameNode, GameTree } from '@/lib/api';
import type { Op } from '@/protocol/ops';
import roomReducer from '@/store/room';
import { FakeChannel } from '@/test/fakeChannel';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function node(partial: Partial<GameNode>): GameNode {
  return {
    id: 0,
    ply: 1,
    san: '',
    from: null,
    to: null,
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    fen: START_FEN,
    children: [],
    ...partial,
  };
}

const gameTree: GameTree = {
  headers: { White: 'Alice', Black: 'Bob' },
  result: '*',
  setup: null,
  mainline_ply_count: 2,
  node_count: 3,
  root: node({
    id: 0,
    ply: 0,
    san: null,
    children: [
      node({ id: 1, ply: 1, san: 'e4', from: 'e2', to: 'e4', fen: 'x' }),
      node({ id: 2, ply: 2, san: 'e5', from: 'e7', to: 'e5', fen: 'y' }),
    ],
  }),
};

function makeStore() {
  return configureStore({ reducer: { room: roomReducer } });
}

const moveOp: Op = {
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

function setGameOp(seq: number, tree: GameTree, gameId = 'game-1'): Op {
  return {
    seq,
    author: 'profile-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'set_game',
    payload: { game_id: gameId, tree },
  };
}

function selectOp(seq: number, gameId: string): Op {
  return {
    seq,
    author: 'profile-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'select_game',
    payload: { game_id: gameId },
  };
}

function cursorOp(seq: number, node_id: number): Op {
  return {
    seq,
    author: 'profile-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'set_cursor',
    payload: { node_id },
  };
}

const followTree: GameTree = {
  headers: { White: 'Alice', Black: 'Bob' },
  result: '*',
  setup: null,
  mainline_ply_count: 2,
  node_count: 3,
  root: node({
    id: 0,
    ply: 0,
    san: null,
    children: [
      node({
        id: 1,
        ply: 1,
        san: 'e4',
        from: 'e2',
        to: 'e4',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      }),
      node({
        id: 2,
        ply: 2,
        san: 'e5',
        from: 'e7',
        to: 'e5',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
      }),
    ],
  }),
};

const secondTree: GameTree = {
  headers: { White: 'Carol', Black: 'Dave' },
  result: '1-0',
  setup: null,
  mainline_ply_count: 2,
  node_count: 3,
  root: node({
    id: 0,
    ply: 0,
    san: null,
    children: [
      node({ id: 1, ply: 1, san: 'd4', from: 'd2', to: 'd4', fen: 'x' }),
      node({ id: 2, ply: 2, san: 'd5', from: 'd7', to: 'd5', fen: 'y' }),
    ],
  }),
};

describe('RoomView', () => {
  let channel: FakeChannel;
  let channelFactory: () => FakeChannel;

  beforeEach(() => {
    channel = new FakeChannel();
    channelFactory = () => channel;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error(`unmocked fetch`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderRoom(slug = 'abc12', onLeave = vi.fn(), selfId: string | null = null) {
    const store = makeStore();
    const view = render(
      <Provider store={store}>
        <RoomView slug={slug} onLeave={onLeave} selfId={selfId} channelFactory={channelFactory} />
      </Provider>,
    );
    return { store, onLeave, view };
  }

  it('shows the room code and joins the channel', async () => {
    renderRoom();
    expect(screen.getByText('ABC12')).toBeInTheDocument();
    expect(channel.joined).toBe(true);
    expect(screen.getByText('Copy')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Connecting…')).not.toBeInTheDocument());
  });

  it('shows joining members from presence diffs', async () => {
    renderRoom();
    await waitFor(() => expect(screen.queryByText('Connecting…')).not.toBeInTheDocument());
    act(() =>
      channel.emit('presence_diff', {
        joins: { 'profile-2': { metas: [{ name: 'Swift Falcon 17' }] } },
        leaves: {},
      }),
    );
    expect(await screen.findByText('Swift Falcon 17')).toBeInTheDocument();
  });

  it('lists ops replayed on join with author names', async () => {
    channel.joinReturn = { ops: [moveOp] };
    renderRoom();
    expect(await screen.findByText('1. e4')).toBeInTheDocument();
  });

  it('appends echoed ops from the channel', async () => {
    renderRoom();
    await waitFor(() => expect(screen.queryByText('Connecting…')).not.toBeInTheDocument());
    act(() => channel.emit('new_op', moveOp));
    expect(await screen.findByText('1. e4')).toBeInTheDocument();
  });

  it('leaves the room when clicking leave', () => {
    const { onLeave } = renderRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('shows the import form when the room has no game', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');
    expect(await screen.findByText('Import a game')).toBeInTheDocument();
    expect(screen.getByLabelText('PGN')).toBeInTheDocument();
  });

  it('shows a waiting message to viewers in an empty room', async () => {
    renderRoom();
    expect(
      await screen.findByText('Waiting for the room owner to share a game…'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import PGN' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New game' })).not.toBeInTheDocument();
  });

  it('imports a game by pushing a set_game op', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ tree: gameTree }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    );
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');

    fireEvent.change(await screen.findByLabelText('PGN'), { target: { value: '1. e4 e5 *' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(channel.pushes.length).toBe(1));
    expect(channel.pushes[0]).toEqual({
      event: 'op',
      payload: { type: 'set_game', payload: { game_id: expect.any(String), tree: gameTree } },
    });
  });

  it('shows the board once the set_game echo arrives', async () => {
    renderRoom();
    await waitFor(() => expect(screen.queryByText('Connecting…')).not.toBeInTheDocument());

    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_game',
      payload: { tree: gameTree },
    };
    act(() => channel.emit('new_op', op));

    expect(await screen.findAllByText('Alice – Bob')).toHaveLength(2);
    expect(screen.getByTestId('square-e2')).toHaveTextContent('♙');
    expect(screen.getByText('Imported a game')).toBeInTheDocument();
  });

  it('reopens the import form to add another game', async () => {
    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_game',
      payload: { game_id: 'game-1', tree: gameTree },
    };
    channel.joinReturn = { ops: [op], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');

    expect(await screen.findByRole('button', { name: 'Alice – Bob' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import PGN' }));
    expect(screen.getByLabelText('PGN')).toBeInTheDocument();
  });

  it('marks the set_game author as presenting in the member list', async () => {
    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: { 'profile-1': 'owner' } };
    renderRoom();

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    expect(await screen.findAllByText('Brave Otter 42')).toHaveLength(2);
    expect(screen.getAllByText('Presenting')).toHaveLength(2);
  });

  it('keeps cursor ops out of the activity feed', async () => {
    channel.joinReturn = {
      ops: [setGameOp(1, gameTree), cursorOp(2, 1)],
    };
    renderRoom();

    expect(await screen.findByText('Imported a game')).toBeInTheDocument();
    expect(screen.queryByText('#2')).not.toBeInTheDocument();
  });

  it('follows the presenter cursor through the room', async () => {
    channel.joinReturn = {
      ops: [setGameOp(1, followTree), cursorOp(2, 2)],
      roles: { 'profile-1': 'owner' },
    };
    renderRoom();

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    await waitFor(() => expect(screen.getByTestId('square-e5')).toHaveTextContent('♟'));
    expect(screen.getByRole('button', { name: 'Following presenter' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    act(() => channel.emit('new_op', cursorOp(3, 1)));

    await waitFor(() => expect(screen.getByTestId('square-e4')).toHaveTextContent('♙'));
  });

  it('creates an empty game with the New game button', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');

    fireEvent.click(screen.getByRole('button', { name: 'New game' }));

    await waitFor(() => expect(channel.pushes.length).toBe(1));
    const pushed = channel.pushes[0] as {
      event: string;
      payload: { type: string; payload: { game_id: string; tree: GameTree } };
    };
    expect(pushed.event).toBe('op');
    expect(pushed.payload.type).toBe('set_game');
    const gameId = pushed.payload.payload.game_id;
    expect(gameId).toEqual(expect.any(String));
    expect(pushed.payload.payload.tree).toEqual(
      expect.objectContaining({ headers: {}, result: '*', node_count: 1 }),
    );

    act(() =>
      channel.emit('new_op', {
        seq: 1,
        author: 'profile-1',
        ts: '2026-01-01T00:00:00Z',
        type: 'set_game',
        payload: { game_id: gameId, tree: pushed.payload.payload.tree },
      }),
    );

    expect(await screen.findByRole('button', { name: 'Untitled game' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('square-e2')).toHaveTextContent('♙');
  });

  it('adds a second game without yanking the current view', async () => {
    renderRoom();

    act(() => channel.emit('new_op', setGameOp(1, gameTree)));
    act(() => channel.emit('new_op', setGameOp(2, secondTree, 'game-2')));

    expect(await screen.findByRole('button', { name: /Carol – Dave/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alice – Bob' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: /Carol – Dave/ }));

    expect(screen.getByRole('button', { name: /Carol – Dave/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Alice – Bob' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('announces a game switch as the presenter', async () => {
    channel.joinReturn = {
      ops: [setGameOp(1, gameTree), setGameOp(2, secondTree, 'game-2')],
      roles: { 'profile-1': 'owner' },
    };
    renderRoom('abc12', vi.fn(), 'profile-1');

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Alice – Bob' }));

    await waitFor(() => expect(channel.pushes.length).toBeGreaterThanOrEqual(2));
    const pushed = channel.pushes as {
      event: string;
      payload: { type: string; payload: Record<string, unknown> };
    }[];
    expect(
      pushed.some(
        (push) =>
          push.event === 'op' &&
          push.payload.type === 'select_game' &&
          push.payload.payload.game_id === 'game-1',
      ),
    ).toBe(true);
    expect(
      pushed.some(
        (push) =>
          push.event === 'op' &&
          push.payload.type === 'set_cursor' &&
          push.payload.payload.node_id === 0,
      ),
    ).toBe(true);
  });

  it('follows the presenter when they switch to another game', async () => {
    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: { 'profile-1': 'owner' } };
    renderRoom();

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    act(() => channel.emit('new_op', setGameOp(2, secondTree, 'game-2')));
    act(() => channel.emit('new_op', selectOp(3, 'game-2')));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Carol – Dave/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('plays a move on the board as the presenter', async () => {
    channel.joinReturn = { ops: [setGameOp(1, gameTree)] };
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              moves: [
                {
                  from: 'e2',
                  to: 'e4',
                  promotion: null,
                  san: 'e4',
                  fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
                  status: 'active',
                },
                {
                  from: 'g1',
                  to: 'f3',
                  promotion: null,
                  san: 'Nf3',
                  fen: 'rnbqkbnr/pppppppp/8/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 1',
                  status: 'active',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    );
    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    fireEvent.click(await screen.findByTestId('square-e2'));
    await waitFor(() => expect(screen.getByTestId('target-e4')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('square-e4'));

    await waitFor(() => expect(channel.pushes.length).toBeGreaterThanOrEqual(1));
    const movePush = channel.pushes.find(
      (push) => (push.payload as { type?: string }).type === 'move_at_ply',
    );
    expect(movePush).toEqual({
      event: 'op',
      payload: {
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
    });
  });

  it('lets the owner promote a member to collaborator', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
        'profile-2': { metas: [{ name: 'Swift Falcon 17' }] },
      }),
    );

    await waitFor(() => expect(screen.getByText('Swift Falcon 17')).toBeInTheDocument());
    expect(screen.getByRole('img', { name: 'Owner' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('set-role-profile-2'));

    await waitFor(() => expect(channel.pushes.length).toBe(1));
    expect(channel.pushes[0]).toEqual({
      event: 'set_role',
      payload: { member_id: 'profile-2', role: 'collaborator' },
    });
  });

  it('lets the owner demote a collaborator back to viewer', async () => {
    channel.joinReturn = {
      ops: [],
      roles: { 'profile-1': 'owner', 'profile-2': 'collaborator' },
    };
    renderRoom('abc12', vi.fn(), 'profile-1');

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
        'profile-2': { metas: [{ name: 'Swift Falcon 17' }] },
      }),
    );

    const demote = await screen.findByRole('button', { name: 'Demote' });
    fireEvent.click(demote);

    await waitFor(() => expect(channel.pushes.length).toBe(1));
    expect(channel.pushes[0]).toEqual({
      event: 'set_role',
      payload: { member_id: 'profile-2', role: 'viewer' },
    });
  });

  it('non-owners do not get promote controls', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom();

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
        'profile-2': { metas: [{ name: 'Swift Falcon 17' }] },
      }),
    );

    await waitFor(() => expect(screen.getByText('Swift Falcon 17')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Promote' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Demote' })).not.toBeInTheDocument();
  });

  it('updates member role icons when a role_update arrives', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner', 'profile-2': 'viewer' } };
    renderRoom();

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
        'profile-2': { metas: [{ name: 'Swift Falcon 17' }] },
      }),
    );

    await waitFor(() => expect(screen.getByRole('img', { name: 'Viewer' })).toBeInTheDocument());
    act(() => channel.emit('role_update', { member_id: 'profile-2', role: 'collaborator' }));

    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Collaborator' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('img', { name: 'Viewer' })).not.toBeInTheDocument();
  });
});
