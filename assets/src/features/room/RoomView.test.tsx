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

function setGameOp(seq: number, tree: GameTree, gameId = 'game-1', evidenceGid?: number): Op {
  return {
    seq,
    author: 'profile-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'set_game',
    payload:
      evidenceGid === undefined
        ? { game_id: gameId, tree }
        : { game_id: gameId, tree, evidence_gid: evidenceGid },
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
    document.querySelectorAll('[data-testid="room-test-header-slot"]').forEach((element) => {
      element.remove();
    });
  });

  function renderRoom(slug = 'abc12', onLeave = vi.fn(), selfId: string | null = null) {
    const store = makeStore();
    // The app bar's room slot (ADR-0031): Share + the presence strip portal
    // into it. Tests append one to the body, like the app shell would.
    const headerSlot = document.createElement('div');
    headerSlot.dataset.testid = 'room-test-header-slot';
    document.body.appendChild(headerSlot);
    const view = render(
      <Provider store={store}>
        <RoomView
          slug={slug}
          onLeave={onLeave}
          selfId={selfId}
          channelFactory={channelFactory}
          headerSlot={headerSlot}
        />
      </Provider>,
    );
    return { store, onLeave, view, headerSlot };
  }

  /** The presence popover: member rows live behind the header strip. */
  async function openMembers() {
    fireEvent.click(await screen.findByRole('button', { name: /\d+ members?/ }));
  }

  it('joins the channel and shows the member list once joined', async () => {
    renderRoom();
    expect(channel.joined).toBe(true);

    // Members live in the header presence strip's popover (ADR-0031).
    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );
    await openMembers();
    expect(await screen.findByTestId('member-list')).toBeInTheDocument();
    expect(screen.getByText('Brave Otter 42')).toBeInTheDocument();
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
    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );
    await openMembers();
    act(() =>
      channel.emit('presence_diff', {
        joins: { 'profile-2': { metas: [{ name: 'Swift Falcon 17' }] } },
        leaves: {},
      }),
    );
    expect(await screen.findByText('Swift Falcon 17')).toBeInTheDocument();
  });

  it('shows the empty state with import and fresh-board actions when the room has no game', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');
    expect(await screen.findByText('Empty room')).toBeInTheDocument();

    fireEvent.click(document.getElementById('empty-import-button') as HTMLElement);
    expect(await screen.findByLabelText('PGN')).toBeInTheDocument();
  });

  it('shows a waiting message to viewers in an empty room', async () => {
    renderRoom();
    expect(await screen.findByText('Nothing to analyse yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import games' })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Import games' })).not.toBeInTheDocument();

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

    await waitFor(() => expect(document.getElementById('empty-import-button')).not.toBeNull());
    fireEvent.click(document.getElementById('empty-import-button') as HTMLElement);
    fireEvent.change(await screen.findByLabelText('PGN'), { target: { value: '1. e4 e5 *' } });
    await screen.findByText('Valid PGN');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(channel.pushes.length).toBe(1));
    expect(channel.pushes[0]).toEqual({
      event: 'op',
      payload: { type: 'set_game', payload: { game_id: expect.any(String), tree: gameTree } },
    });
  });

  it('re-points the presenter focus at the first game after a multi-game import', async () => {
    const other = { ...gameTree, headers: { White: 'Carol', Black: 'Dave' } };
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ trees: [gameTree, other], failures: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    );
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');

    // Presenting derives from presence — the owner must be "in the room".
    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    await waitFor(() => expect(document.getElementById('empty-import-button')).not.toBeNull());
    fireEvent.click(document.getElementById('empty-import-button') as HTMLElement);
    fireEvent.change(await screen.findByLabelText('PGN'), {
      target: { value: '1. e4 e5 *\n\n[Event "G2"]\n\n1. d4 d5 *\n' },
    });
    await screen.findByText('2 games found');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    // set_game ×2, then select_game back to the first — otherwise the
    // op-log presenter focus stays on the last imported game.
    await waitFor(() => expect(channel.pushes.length).toBe(3));
    const firstId = (channel.pushes[0].payload as { payload: { game_id: string } }).payload.game_id;
    expect(channel.pushes[2].payload).toEqual({
      type: 'select_game',
      payload: { game_id: firstId },
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

    await waitFor(() => expect(document.getElementById('empty-import-button')).not.toBeNull());
    fireEvent.click(document.getElementById('empty-import-button') as HTMLElement);
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
    // The empty state (a viewer waiting) is the join-complete marker.
    await screen.findByText('Nothing to analyse yet');

    const op: Op = {
      seq: 1,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_game',
      payload: { game_id: 'game-1', tree: gameTree },
    };
    act(() => channel.emit('new_op', op));

    expect(await screen.findByRole('heading', { name: 'Alice – Bob' })).toBeInTheDocument();
    expect(pieceAt('square-e4')).toBe('wp');
  });

  it('shows chat messages from the channel and sends chat ops', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');
    // Empty room: the Chat tab is the sidebar's first tab (ADR-0031).
    await screen.findByTestId('chat-list');

    act(() =>
      channel.emit('new_op', {
        seq: 1,
        author: 'profile-2',
        ts: '2026-01-01T00:00:00Z',
        type: 'chat',
        payload: { text: 'anyone here?' },
      } as Op),
    );

    expect(await screen.findByText('anyone here?')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message the room...'), {
      target: { value: 'yes!' },
    });
    fireEvent.keyDown(screen.getByLabelText('Message the room...'), { key: 'Enter' });

    expect(channel.pushes).toEqual([
      { event: 'op', payload: { type: 'chat', payload: { text: 'yes!' } } },
    ]);
  });

  it('removes the viewed game via its rail button and falls back to the next game', async () => {
    channel.joinReturn = {
      ops: [setGameOp(1, gameTree, 'game-1'), setGameOp(2, followTree, 'game-2')],
      roles: { 'profile-1': 'owner' },
    };
    renderRoom('abc12', vi.fn(), 'profile-1');
    // game-1 is the default selection; its remove button carries its id.
    await screen.findByTestId('remove-game-game-1');

    fireEvent.click(await screen.findByTestId('remove-game-game-1'));
    // The removal is one op; the board updates only when the echo lands.
    await waitFor(() =>
      expect(channel.pushes).toContainEqual({
        event: 'op',
        payload: { type: 'remove_game', payload: { game_id: 'game-1' } },
      }),
    );

    act(() =>
      channel.emit('new_op', {
        seq: 3,
        author: 'profile-1',
        ts: '2026-01-01T00:00:00Z',
        type: 'remove_game',
        payload: { game_id: 'game-1' },
      } as Op),
    );

    // game-1 is gone from the rail and the view fell back to game-2.
    await waitFor(() => expect(screen.queryByTestId('remove-game-game-1')).toBeNull());
    expect(screen.getByTestId('remove-game-game-2')).toBeInTheDocument();
  });

  it('hides the chat input for viewers — they read along (ADR-0023)', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-2');
    await screen.findByTestId('chat-list');

    act(() =>
      channel.emit('new_op', {
        seq: 1,
        author: 'profile-1',
        ts: '2026-01-01T00:00:00Z',
        type: 'chat',
        payload: { text: 'anyone here?' },
      } as Op),
    );

    expect(await screen.findByText('anyone here?')).toBeInTheDocument();
    expect(screen.queryByLabelText('Message the room...')).not.toBeInTheDocument();
    expect(screen.getByText('Only the owner and collaborators can chat.')).toBeInTheDocument();
  });

  it('badges the Chat tab with unread messages and clears on open', async () => {
    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');
    await screen.findByRole('heading', { name: 'Alice – Bob' });

    // A live chat op while another tab is active: the badge counts it.
    act(() =>
      channel.emit('new_op', {
        seq: 2,
        author: 'profile-2',
        ts: '2026-01-01T00:00:00Z',
        type: 'chat',
        payload: { text: 'hi there' },
      } as Op),
    );

    expect(await screen.findByTestId('chat-badge')).toHaveTextContent('1');

    // Opening the Chat tab marks the backlog read.
    fireEvent.click(screen.getByRole('tab', { name: /Chat/ }));
    expect(screen.queryByTestId('chat-badge')).not.toBeInTheDocument();
    expect(screen.getByText('hi there')).toBeInTheDocument();
  });

  it('does not badge replayed chat history from before the join', async () => {
    const chatOp: Op = {
      seq: 2,
      author: 'profile-2',
      ts: '2026-01-01T00:00:00Z',
      type: 'chat',
      payload: { text: 'old news' },
    };
    channel.joinReturn = {
      ops: [setGameOp(1, gameTree), chatOp],
      roles: { 'profile-1': 'owner' },
    };
    renderRoom('abc12', vi.fn(), 'profile-1');

    await screen.findByRole('heading', { name: 'Alice – Bob' });
    expect(screen.queryByTestId('chat-badge')).not.toBeInTheDocument();
  });

  it('lets the owner delete a chat message; the echo removes it', async () => {
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');
    await screen.findByTestId('chat-list');

    act(() =>
      channel.emit('new_op', {
        seq: 1,
        author: 'profile-2',
        ts: '2026-01-01T00:00:00Z',
        type: 'chat',
        payload: { text: 'inappropriate' },
      } as Op),
    );

    fireEvent.click(await screen.findByTestId('chat-delete-1'));

    expect(channel.pushes).toEqual([
      { event: 'op', payload: { type: 'delete_chat', payload: { seq: 1 } } },
    ]);

    // The echo is the only application path (ADR-0005): the message is
    // removed when the delete op comes back from the server.
    act(() =>
      channel.emit('new_op', {
        seq: 2,
        author: 'profile-1',
        ts: '2026-01-01T00:00:01Z',
        type: 'delete_chat',
        payload: { seq: 1 },
      } as Op),
    );

    expect(screen.queryByText('inappropriate')).not.toBeInTheDocument();
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

    // The games list is chrome (the games rail, ADR-0032).
    await screen.findByRole('tab', { name: 'Chat' });
    expect(await screen.findByRole('button', { name: 'Alice – Bob' })).toBeInTheDocument();
    fireEvent.click(document.getElementById('add-game-button') as HTMLElement);
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

    await openMembers();
    const list = screen.getByTestId('member-list');
    expect(await within(list).findByText('Brave Otter 42')).toBeInTheDocument();
    expect(screen.getAllByText('Presenting')).toHaveLength(1);
    // …and the games list marks the presented game with a compact gold dot.
    expect(screen.getByRole('img', { name: 'Presenting' })).toBeInTheDocument();
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
    await openMembers();
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

    // The games rail shows the actions directly (empty room included).
    fireEvent.click(document.getElementById('new-game-button') as HTMLElement);

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

    // The games rail is chrome (ADR-0032).
    await screen.findByRole('tab', { name: 'Chat' });
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

    await screen.findByRole('tab', { name: 'Chat' });
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

    await screen.findByRole('tab', { name: 'Chat' });
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
    await screen.findByRole('tab', { name: 'Chat' });
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

    await openMembers();
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

    await openMembers();
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

    await openMembers();
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

    await openMembers();
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

    await openMembers();
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

    await openMembers();
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

  it('does not yank the cursor onto the viewer\u2019s own inserted variation', async () => {
    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');
    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    // Opens at the mainline tip (e4), then back to the start position.
    await waitFor(() => expect(pieceAt('square-e4')).toBe('wp'));
    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    expect(pieceAt('square-e4')).toBeNull();

    // The viewer's own variation insert under the root: the line lands in
    // the tree, but follow-the-tail must NOT jump the cursor onto it —
    // insertLine deliberately leaves the user where they were analyzing.
    const lineOp: Op = {
      seq: 2,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'add_line',
      payload: {
        game_id: 'game-1',
        parent_id: 0,
        moves: [
          {
            san: 'c4',
            from: 'c2',
            to: 'c4',
            promotion: null,
            fen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1',
            status: 'active',
          },
        ],
      },
    };
    act(() => channel.emit('new_op', lineOp));

    // The variation is in the move list; the board still shows the start
    // position (the cursor never moved).
    expect(screen.getByTestId('analysis-move-3')).toBeInTheDocument();
    expect(pieceAt('square-c4')).toBeNull();
    expect(pieceAt('square-e2')).toBe('wp');
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

describe('historical evidence integration', () => {
  let channel: FakeChannel;
  let channelFactory: () => FakeChannel;

  beforeEach(() => {
    channel = new FakeChannel();
    channelFactory = () => channel;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderRoom(slug = 'abc12', onLeave = vi.fn(), selfId: string | null = null) {
    const store = makeStore();
    render(
      <Provider store={store}>
        <RoomView slug={slug} onLeave={onLeave} selfId={selfId} channelFactory={channelFactory} />
      </Provider>,
    );
  }

  const E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

  function evidenceCandidate(): import('@/features/historicalEvidence/types').EvidenceCandidate {
    return {
      id: 'exact-1-1',
      strategy: 'exact',
      stm: 'b',
      fen: E4_FEN,
      gid: 7,
      ply: 1,
      game: {
        gid: 7,
        white: 'Carol',
        black: 'Dave',
        result: '1-0',
        date: '2017.05.01',
        eco: 'A00',
        opening: 'Uncommon Opening',
        white_elo: null,
        black_elo: null,
        event: 'Fixture',
        time_control: '300+0',
        site: 'fix01',
      },
      position: {
        dims: {
          pawn_structure: 'same',
          material: 'same',
          piece_placement: { matches: 16, mismatches: 0, ref_pieces: 16 },
          king_position: 'same',
          side_to_move: 'same',
          castling: 'same',
        },
        differences: [],
      },
      route: {
        shared_plies: 1,
        ref_ply: 1,
        diverged_ply: null,
        ref_move: null,
        cand_move: null,
        ply_gap: 0,
        extra_white: [],
        extra_black: [],
        missing_white: [],
        missing_black: [],
      },
      continuation: { moves: [], differences: [] },
      families: {
        membership: {
          status: 'member',
          member_of: 1,
          sim: 1,
          family_occurrences: 2,
          family_games: 2,
        },
        skeleton: {
          white: {
            status: 'member',
            family_id: 1,
            sim: 1,
            family_occurrences: 2,
            family_games: 2,
          },
          black: {
            status: 'member',
            family_id: 1,
            sim: 1,
            family_occurrences: 2,
            family_games: 2,
          },
        },
      },
      historical: { occurrences: 1, games: 1, same_game_only: false },
      flags: [],
    };
  }

  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('never adds a game that is already in the room', async () => {
    // The corpus game IS the analyzed game (same tree as game-1).
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/historical-evidence/games/')) {
          return jsonResponse({ tree: gameTree });
        }
        if (url.includes('/api/historical-evidence')) {
          return jsonResponse({
            reference: { fen: E4_FEN, occurrences: 1, games: 1, families: [] },
            candidates: [evidenceCandidate()],
            timings: { candidates_ms: 1, menu_ms: 1, evidence_ms: 1, total_ms: 3 },
          });
        }
        throw new Error(`unmocked fetch: ${url}`);
      }),
    );

    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');
    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    fireEvent.click(await screen.findByTestId('find-examples-button'));
    fireEvent.click(await screen.findByTestId('historical-evidence-add-game'));

    // The fingerprint matches a room game: no set_game, no select_game —
    // and the card still reports it as in the room.
    await waitFor(() =>
      expect(screen.getByTestId('historical-evidence-add-game')).toHaveTextContent(
        'Same game — already added',
      ),
    );
    const pushes = channel.pushes as {
      event: string;
      payload: { type: string; payload: Record<string, unknown> };
    }[];
    expect(pushes.some((push) => push.payload.type === 'set_game')).toBe(false);
    expect(pushes.some((push) => push.payload.type === 'select_game')).toBe(false);
    expect(screen.getByRole('heading', { name: 'Alice – Bob' })).toBeInTheDocument();
  });

  it('adds a historical game without switching and opens it at the candidate move', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/historical-evidence/games/')) {
          return jsonResponse({ tree: secondTree });
        }
        if (url.includes('/api/historical-evidence')) {
          return jsonResponse({
            reference: { fen: E4_FEN, occurrences: 1, games: 1, families: [] },
            candidates: [evidenceCandidate()],
            timings: { candidates_ms: 1, menu_ms: 1, evidence_ms: 1, total_ms: 3 },
          });
        }
        throw new Error(`unmocked fetch: ${url}`);
      }),
    );

    channel.joinReturn = { ops: [setGameOp(1, gameTree)], roles: { 'profile-1': 'owner' } };
    renderRoom('abc12', vi.fn(), 'profile-1');
    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    fireEvent.click(await screen.findByTestId('find-examples-button'));
    fireEvent.click(await screen.findByTestId('historical-evidence-add-game'));

    // The analyzed game stays on screen — the add never steals the view.
    expect(screen.getByRole('heading', { name: 'Alice – Bob' })).toBeInTheDocument();

    const pushes = channel.pushes as {
      event: string;
      payload: { type: string; payload: Record<string, unknown> };
    }[];
    // The add fetches the corpus game before pushing the op.
    await waitFor(() =>
      expect(
        pushes.some(
          (push) => push.payload.type === 'set_game' && push.payload.payload.game_id !== 'game-1',
        ),
      ).toBe(true),
    );
    const setGame = pushes.find(
      (push) => push.payload.type === 'set_game' && push.payload.payload.game_id !== 'game-1',
    );
    expect(setGame).toBeDefined();
    // The corpus gid rides the op, so every client's cards can agree.
    expect(setGame?.payload.payload.evidence_gid).toBe(7);
    const addedId = setGame?.payload.payload.game_id as string;
    expect(
      pushes.some(
        (push) => push.payload.type === 'select_game' && push.payload.payload.game_id === addedId,
      ),
    ).toBe(false);
    // The presenting adder re-points the room at the game being viewed.
    expect(
      pushes.some(
        (push) => push.payload.type === 'select_game' && push.payload.payload.game_id === 'game-1',
      ),
    ).toBe(true);

    // The echo lands (carrying the corpus gid): the new game appears in
    // the Games panel and the card flips to "same game" — derived from the
    // log now, so every client agrees.
    act(() => channel.emit('new_op', setGameOp(2, secondTree, addedId, 7)));
    await waitFor(() =>
      expect(screen.getByTestId('historical-evidence-add-game')).toHaveTextContent(
        'Same game — already added',
      ),
    );
    // The new game appears in the games rail (ADR-0032).
    expect(await screen.findByRole('button', { name: /Carol – Dave/ })).toBeInTheDocument();

    // Opening it starts at the candidate's move (1... d4), not the tail.
    fireEvent.click(screen.getByRole('button', { name: /Carol – Dave/ }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Carol – Dave' })).toBeInTheDocument(),
    );
    expect(pieceAt('square-d4')).toBe('wp');
  });
});

describe('per-game cursor memory', () => {
  let channel: FakeChannel;
  let channelFactory: () => FakeChannel;

  beforeEach(() => {
    channel = new FakeChannel();
    channelFactory = () => channel;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderRoom(slug = 'abc12', onLeave = vi.fn(), selfId: string | null = null) {
    const store = makeStore();
    render(
      <Provider store={store}>
        <RoomView slug={slug} onLeave={onLeave} selfId={selfId} channelFactory={channelFactory} />
      </Provider>,
    );
  }

  function lineTree(players: [string, string], moveFens: string[]): GameTree {
    // moveFens[i] is the fen after move i+1 (all played from the root).
    let tip = node({ id: 0, ply: 0, san: null });
    const roots = [tip];
    moveFens.forEach((fen, index) => {
      const ply = index + 1;
      const next = node({
        id: ply,
        ply,
        san: `m${ply}`,
        from: 'e2',
        to: 'e4',
        fen,
      });
      tip.children = [next];
      roots.push(next);
      tip = next;
    });
    return {
      headers: { White: players[0], Black: players[1] },
      result: '*',
      setup: null,
      mainline_ply_count: moveFens.length,
      node_count: moveFens.length + 1,
      root: roots[0] as GameNode,
    };
  }

  // A: e4 e5 Nf3 Nc6 (tip = Nc6); B: d4 d5 Nf3 Nf6 (tip = Nf6).
  const treeA = lineTree(
    ['Alice', 'Bob'],
    [
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    ],
  );
  const treeB = lineTree(
    ['Carol', 'Dave'],
    [
      'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq d6 0 2',
      'rnbqkbnr/ppp1pppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq - 1 2',
      'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq - 2 3',
    ],
  );

  it('restores each game at its own last viewed position across switches', async () => {
    channel.joinReturn = {
      ops: [setGameOp(1, treeA), setGameOp(2, treeB, 'game-2')],
      roles: { 'profile-1': 'owner' },
    };
    renderRoom('abc12', vi.fn(), 'profile-1');
    act(() =>
      channel.emit('presence_state', {
        'profile-1': { metas: [{ name: 'Brave Otter 42' }] },
      }),
    );

    // Game A opens at its tail: Nc6 is on c6.
    await waitFor(() => expect(pieceAt('square-c6')).toBe('bn'));
    // Game switches happen in the games rail (ADR-0032).
    // Walk A back to move 2 (1... e5).
    fireEvent.click(screen.getByTestId('analysis-move-2'));
    expect(pieceAt('square-e5')).toBe('bp');
    expect(pieceAt('square-c6')).toBeNull();

    // Game B opens at its tail (Nf6), then moves back to move 3 (Nf3).
    fireEvent.click(await screen.findByRole('button', { name: /Carol – Dave/ }));
    await waitFor(() => expect(pieceAt('square-f6')).toBe('bn'));
    fireEvent.click(screen.getByTestId('analysis-move-3'));
    expect(pieceAt('square-f3')).toBe('wn');
    expect(pieceAt('square-f6')).toBeNull();

    // Back to A: still on move 2 (e5), not the tail.
    fireEvent.click(screen.getByRole('button', { name: /Alice – Bob/ }));
    await waitFor(() => expect(pieceAt('square-e5')).toBe('bp'));
    expect(pieceAt('square-c6')).toBeNull();

    // Back to B: still on move 3 (Nf3), not the tail.
    fireEvent.click(screen.getByRole('button', { name: /Carol – Dave/ }));
    await waitFor(() => expect(pieceAt('square-f3')).toBe('wn'));
    expect(pieceAt('square-f6')).toBeNull();
  });
});
