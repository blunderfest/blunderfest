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
  payload: { ply: 1, san: 'e4' },
};

function setGameOp(seq: number, tree: GameTree): Op {
  return {
    seq,
    author: 'profile-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'set_game',
    payload: { tree },
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

  function renderRoom(slug = 'abc12', onLeave = vi.fn()) {
    const store = makeStore();
    const view = render(
      <Provider store={store}>
        <RoomView slug={slug} onLeave={onLeave} channelFactory={channelFactory} />
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
    renderRoom();
    expect(await screen.findByText('Import a game')).toBeInTheDocument();
    expect(screen.getByLabelText('PGN')).toBeInTheDocument();
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
    renderRoom();

    fireEvent.change(await screen.findByLabelText('PGN'), { target: { value: '1. e4 e5 *' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(channel.pushes.length).toBe(1));
    expect(channel.pushes[0]).toEqual({
      event: 'op',
      payload: { type: 'set_game', payload: { tree: gameTree } },
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

    expect(await screen.findByText('Alice – Bob')).toBeInTheDocument();
    expect(screen.getByTestId('square-e2')).toHaveTextContent('♙');
    expect(screen.getByText('Imported a game')).toBeInTheDocument();
  });

  it('reopens the import form to replace the game', async () => {
    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_game',
      payload: { tree: gameTree },
    };
    channel.joinReturn = { ops: [op] };
    renderRoom();

    expect(await screen.findByText('Alice – Bob')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import a new game' }));
    expect(screen.getByLabelText('PGN')).toBeInTheDocument();
  });

  it('marks the set_game author as presenting in the member list', async () => {
    channel.joinReturn = { ops: [setGameOp(1, gameTree)] };
    renderRoom();

    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    expect(await screen.findByText('Brave Otter 42')).toBeInTheDocument();
    expect(screen.getByText('Presenting')).toBeInTheDocument();
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
    channel.joinReturn = { ops: [setGameOp(1, followTree), cursorOp(2, 2)] };
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
});
