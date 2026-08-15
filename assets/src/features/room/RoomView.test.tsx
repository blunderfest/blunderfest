import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
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
      node({
        id: 1,
        ply: 1,
        san: 'e4',
        from: 'e2',
        to: 'e4',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      }),
      node({
        id: 2,
        ply: 2,
        san: 'e5',
        from: 'e7',
        to: 'e5',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      }),
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
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
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

function selectOp(seq: number, gameId: string, author = 'profile-1'): Op {
  return {
    seq,
    author,
    ts: '2026-01-01T00:00:00Z',
    type: 'select_game',
    payload: { game_id: gameId },
  };
}

function cursorOp(seq: number, node_id: number, author = 'profile-1'): Op {
  return {
    seq,
    author,
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
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
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
      node({
        id: 1,
        ply: 1,
        san: 'd4',
        from: 'd2',
        to: 'd4',
        fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      }),
      node({
        id: 2,
        ply: 2,
        san: 'd5',
        from: 'd7',
        to: 'd5',
        fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2',
      }),
    ],
  }),
};

function pieceAt(testId: string): string | null {
  return (
    screen.getByTestId(testId).querySelector('[data-piece]')?.getAttribute('data-piece') ?? null
  );
}

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

  it('joins the channel and shows the member list once joined', async () => {
    renderRoom();
    expect(channel.joined).toBe(true);
    expect(await screen.findByTestId('member-list')).toBeInTheDocument();
  });

  it('stores the server region from the join reply', async () => {
    channel.joinReturn = { ops: [], region: 'ord' };
    const { store } = renderRoom();

    await waitFor(() => expect(store.getState().room.region).toBe('ord'));
  });

  it('shows a not-found screen and a way home when the join is rejected', async () => {
    channel.joinError = { reason: 'room_not_found' };
    const onLeave = vi.fn();
    renderRoom('abc12', onLeave);
    expect(await screen.findByText('Room not found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No room answers to this code. Codes are 5 characters and never contain i, l, o, 0 or 1 — it may have been mistyped, or the room expired.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(onLeave).toHaveBeenCalled();
  });

  it('shows joining members from presence diffs', async () => {
    renderRoom();
    await screen.findByTestId('member-list');
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
    await screen.findByTestId('member-list');
    act(() => channel.emit('new_op', moveOp));
    expect(await screen.findByText('1. e4')).toBeInTheDocument();
  });

  it('shows the empty state with import and fresh-board actions when the room has no game', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');
    expect(await screen.findByText('Empty room')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Import a game' }));
    expect(await screen.findByLabelText('PGN')).toBeInTheDocument();
  });

  it('shows a waiting message to viewers in an empty room', async () => {
    renderRoom();
    expect(await screen.findByText('Nothing to analyse yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import a game' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fresh board' })).not.toBeInTheDocument();
  });

  it('shows a connecting state until the join completes, never the viewer empty state', async () => {
    channel.joinPending = true;
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');

    // While the join is in flight the owner must not see the viewer's
    // "Nothing to analyse yet" empty state.
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    expect(screen.queryByText('Nothing to analyse yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Empty room')).not.toBeInTheDocument();

    act(() => channel.resolveJoin());

    expect(await screen.findByText('Empty room')).toBeInTheDocument();
    expect(screen.queryByText('Nothing to analyse yet')).not.toBeInTheDocument();
  });

  it('read-only rooms show the board but no member list or edit actions', async () => {
    // The demo room: a seeded game, no roles, read-only (ADR-0014).
    channel.joinReturn = { ops: [setGameOp(1, gameTree)], read_only: true };
    renderRoom('abc12', vi.fn(), 'profile-1');

    expect(await screen.findByTestId('square-e4')).toBeInTheDocument();
    expect(screen.queryByTestId('member-list')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import PGN' })).not.toBeInTheDocument();

    // Navigation is local; nothing is sent to a read-only room.
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(channel.pushes).toEqual([]);
  });

  it('read-only rooms send no cursor ops even for a presenter', async () => {
    // The server never produces this state (read-only rooms record no
    // roles); it pins RoomView's contract of sending nothing when readOnly.
    channel.joinReturn = {
      ops: [setGameOp(1, gameTree)],
      roles: { 'profile-1': 'owner' },
      read_only: true,
    };
    renderRoom('abc12', vi.fn(), 'profile-1');

    fireEvent.click(await screen.findByRole('button', { name: 'Previous' }));

    expect(channel.pushes).toEqual([]);
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

    fireEvent.click(await screen.findByRole('button', { name: 'Import a game' }));
    fireEvent.change(await screen.findByLabelText('PGN'), { target: { value: '1. e4 e5 *' } });
    await screen.findByText('Valid PGN');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(channel.pushes.length).toBe(1));
    expect(channel.pushes[0]).toEqual({
      event: 'op',
      payload: { type: 'set_game', payload: { game_id: expect.any(String), tree: gameTree } },
    });
  });

  it('starts a freshly imported game at the initial position, not the tail', async () => {
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

    fireEvent.click(await screen.findByRole('button', { name: 'Import a game' }));
    fireEvent.change(await screen.findByLabelText('PGN'), { target: { value: '1. e4 e5 *' } });
    await screen.findByText('Valid PGN');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(channel.pushes.length).toBeGreaterThan(0));
    const setGame = channel.pushes[0].payload as {
      type: string;
      payload: { game_id: string; tree: GameTree };
    };
    act(() =>
      channel.emit('new_op', {
        seq: 1,
        author: 'profile-1',
        ts: '2026-01-01T00:00:00Z',
        type: 'set_game',
        payload: { game_id: setGame.payload.game_id, tree: gameTree },
      } as Op),
    );

    // The initial position, not the tail: nothing played yet.
    expect(await screen.findByTestId('ply-counter')).toHaveTextContent('ply 0/2');
    expect(pieceAt('square-e2')).toBe('wp');
    expect(pieceAt('square-e4')).toBeNull();
  });

  it('shows the board once the set_game echo arrives', async () => {
    renderRoom();
    await screen.findByTestId('member-list');

    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_game',
      payload: { tree: gameTree },
    };
    act(() => channel.emit('new_op', op));

    expect(await screen.findAllByText('Alice – Bob')).toHaveLength(2);
    expect(pieceAt('square-e4')).toBe('wp');
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
    expect(screen.getAllByText('Presenting')).toHaveLength(1);
    // …and the games list marks the presented game with a compact gold dot.
    expect(screen.getByRole('img', { name: 'Presenting' })).toBeInTheDocument();
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

    await waitFor(() => expect(pieceAt('square-e5')).toBe('bp'));
    expect(screen.getByRole('button', { name: 'Following presenter' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    act(() => channel.emit('new_op', cursorOp(3, 1)));

    await waitFor(() => expect(pieceAt('square-e4')).toBe('wp'));
  });

  it('follows a handed-off presenter (and falls back to the owner when they leave)', async () => {
    channel.joinReturn = {
      ops: [setGameOp(1, followTree), cursorOp(2, 2)],
      roles: { 'profile-1': 'owner', 'profile-2': 'collaborator' },
    };
    renderRoom();

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Owner' }] },
        'profile-2': { metas: [{ name: 'Driver' }] },
      }),
    );
    await waitFor(() => expect(pieceAt('square-e5')).toBe('bp'));

    // The owner hands the mic to the collaborator; their cursor drives now.
    act(() => channel.emit('presenter_update', { member_id: 'profile-2' }));
    act(() => channel.emit('new_op', cursorOp(3, 1, 'profile-2')));
    await waitFor(() => expect(pieceAt('square-e4')).toBe('wp'));

    // The driver leaves: the floor falls back to the owner's cursor.
    act(() =>
      channel.emit('presence_diff', {
        joins: {},
        leaves: { 'profile-2': { metas: [{ name: 'Driver' }] } },
      }),
    );
    act(() => channel.emit('new_op', cursorOp(4, 2)));
    await waitFor(() => expect(pieceAt('square-e5')).toBe('bp'));
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
    expect(pieceAt('square-e2')).toBe('wp');
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
          push.payload.payload.node_id === 1,
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

  it('stays broken away when the presenter changes after a manual break', async () => {
    channel.joinReturn = {
      ops: [setGameOp(1, gameTree), setGameOp(2, secondTree, 'game-2')],
      roles: { 'profile-1': 'owner' },
    };
    renderRoom();

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
        'profile-2': { metas: [{ name: 'Swift Falcon 17' }] },
      }),
    );

    // We follow the presenter (profile-1) to their latest game.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Carol – Dave/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(pieceAt('square-d4')).toBe('wp');

    // Breaking away locally returns us to the first game…
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Alice – Bob' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );

    // …and when the presenter role moves and the new presenter switches
    // games, our view stays broken away on the first game.
    act(() => channel.emit('role_update', { member_id: 'profile-1', role: 'viewer' }));
    act(() => channel.emit('role_update', { member_id: 'profile-2', role: 'owner' }));
    act(() => channel.emit('new_op', selectOp(3, 'game-2', 'profile-2')));

    await waitFor(() => expect(screen.getByText('Swift Falcon 17')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Alice – Bob' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Carol – Dave/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('plays a move on the board as the presenter', async () => {
    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    await act(async () => {});
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
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          status: 'active',
          parent_id: 0,
        },
      },
    });
  });

  it('rolls back a pending move when the server rejects the op', async () => {
    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: { 'profile-1': 'owner' } };
    // Every op push fails — the move's echo never arrives.
    channel.pushError = { reason: 'op_limit' };
    renderRoom('abc12', vi.fn(), 'profile-1');

    fireEvent.click(await screen.findByRole('button', { name: 'First' }));
    await act(async () => {});
    fireEvent.click(await screen.findByTestId('square-e2'));
    await waitFor(() => expect(screen.getByTestId('target-e4')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('square-e4'));

    // The rejected move never becomes a phantom: the board snaps back to
    // the position it was played from.
    expect(await screen.findByLabelText('Chess board after start position')).toBeInTheDocument();
    expect(pieceAt('square-e4')).toBeNull();
  });

  it('saves a comment on the current position as a comment_at_ply op', async () => {
    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    fireEvent.keyDown(document.body, { key: 'Home' });
    fireEvent.click(await screen.findByRole('button', { name: 'Comment' }));
    const editor = await screen.findByTestId('comment-editor');
    fireEvent.change(editor, { target: { value: 'Sharp position' } });
    fireEvent.click(screen.getByTestId('save-comment'));

    await waitFor(() =>
      expect(
        channel.pushes.some(
          (push) => (push.payload as { type?: string }).type === 'comment_at_ply',
        ),
      ).toBe(true),
    );
    const commentPush = channel.pushes.find(
      (push) => (push.payload as { type?: string }).type === 'comment_at_ply',
    );
    expect(commentPush).toEqual({
      event: 'op',
      payload: {
        type: 'comment_at_ply',
        payload: { game_id: 'game-1', ply: 0, text: 'Sharp position', node_id: 0 },
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

  it('sorts members by role then name', async () => {
    channel.joinReturn = {
      ops: [],
      roles: {
        'profile-1': 'owner',
        'profile-2': 'collaborator',
        'profile-3': 'viewer',
        'profile-4': 'viewer',
      },
    };
    renderRoom('abc12', vi.fn(), 'profile-1');

    act(() =>
      channel.emit('presence_state', {
        'profile-4': { metas: [{ name: 'Zeta Zulu 77' }] },
        'profile-2': { metas: [{ name: 'Brave Otter 42' }] },
        'profile-3': { metas: [{ name: 'Swift Falcon 17' }] },
        'profile-1': { metas: [{ name: 'Proud Raven 65' }] },
      }),
    );

    await waitFor(() => expect(screen.getByText('Proud Raven 65')).toBeInTheDocument());
    const names = within(screen.getByTestId('member-list'))
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(names[0]).toContain('Proud Raven 65');
    expect(names[1]).toContain('Brave Otter 42');
    expect(names[2]).toContain('Swift Falcon 17');
    expect(names[3]).toContain('Zeta Zulu 77');
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

  it('has no axe violations with a game loaded', async () => {
    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: { 'profile-1': 'owner' } };
    const store = makeStore();
    const view = render(
      <main>
        <Provider store={store}>
          <RoomView slug="abc12" onLeave={vi.fn()} selfId={null} channelFactory={channelFactory} />
        </Provider>
      </main>,
    );

    await screen.findAllByText('Alice – Bob');
    const results = await axe(view.container);
    expect(results).toHaveNoViolations();
  });

  it('advances the board when a remote move lands on the viewed position', async () => {
    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: {} };
    renderRoom();

    // Tip of the mainline (e4), then navigate to the start position.
    await waitFor(() => expect(pieceAt('square-e4')).toBe('wp'));
    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    expect(pieceAt('square-e4')).toBeNull();

    const c4Op: Op = {
      seq: 2,
      author: 'profile-2',
      ts: '2026-01-01T00:00:00Z',
      type: 'move_at_ply',
      payload: {
        game_id: 'game-1',
        ply: 1,
        san: 'c4',
        from: 'c2',
        to: 'c4',
        promotion: null,
        fen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1',
        status: 'active',
        parent_id: 0,
      },
    };
    act(() => channel.emit('new_op', c4Op));

    await waitFor(() => expect(pieceAt('square-c4')).toBe('wp'));
  });

  it('opens on the last played move after a rejoin, even in a variation', async () => {
    // Mainline e4, then a variation move c4 played from the root.
    const c4Op: Op = {
      seq: 2,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'move_at_ply',
      payload: {
        game_id: 'game-1',
        ply: 1,
        san: 'c4',
        from: 'c2',
        to: 'c4',
        promotion: null,
        fen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1',
        status: 'active',
        parent_id: 0,
      },
    };
    channel.joinReturn = { ops: [setGameOp(1, gameTree), c4Op], roles: {} };
    renderRoom();

    // The cursor lands on c4 (the move last played), not the mainline tip e4.
    await waitFor(() => expect(pieceAt('square-c4')).toBe('wp'));
    expect(pieceAt('square-e4')).toBeNull();
  });
});
