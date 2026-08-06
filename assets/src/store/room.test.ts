import { describe, expect, it } from 'vitest';
import type { GameTree } from '@/lib/api';
import type { Op, SetGameOp } from '@/protocol/ops';
import roomReducer, {
  applyOp,
  enterRoom,
  joinMember,
  leaveMember,
  leaveRoom,
  replayOps,
  selectActiveGame,
  selectPresenter,
  selectPresenterCursor,
  selectPresenterGameId,
  setActiveGame,
} from './room';

const tree: GameTree = {
  headers: {},
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
};

function moveOp(seq: number): Op {
  return {
    seq,
    author: 'author-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'move_at_ply',
    payload: { ply: 1, san: 'e4' },
  };
}

function cursorOp(seq: number, node_id = 3): Op {
  return {
    seq,
    author: 'author-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'set_cursor',
    payload: { node_id },
  };
}

function selectOp(seq: number, gameId: string, author = 'author-1'): Op {
  return {
    seq,
    author,
    ts: '2026-01-01T00:00:00Z',
    type: 'select_game',
    payload: { game_id: gameId },
  };
}

function setGameOp(seq: number, white: string, gameId = 'game-1'): SetGameOp {
  return {
    seq,
    author: 'author-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'set_game',
    payload: {
      game_id: gameId,
      tree: { ...tree, headers: { White: white } },
    },
  };
}

function initialState() {
  return roomReducer(undefined, { type: '@@init' });
}

describe('room slice', () => {
  it('starts empty', () => {
    expect(initialState()).toEqual({
      slug: null,
      ops: [],
      presence: {},
      games: {},
      activeGameId: null,
    });
  });

  it('enterRoom sets the slug and clears ops, presence and games', () => {
    const state = roomReducer(
      {
        slug: 'old',
        ops: [moveOp(1)],
        presence: { 'author-1': { id: 'author-1', name: 'Brave Otter 42' } },
        games: { 'game-1': tree },
        activeGameId: 'game-1',
      },
      enterRoom({ slug: 'room-123' }),
    );
    expect(state).toEqual({
      slug: 'room-123',
      ops: [],
      presence: {},
      games: {},
      activeGameId: null,
    });
  });

  it('leaveRoom clears everything', () => {
    const state = roomReducer(
      {
        slug: 'room-123',
        ops: [moveOp(1)],
        presence: { 'author-1': { id: 'author-1', name: 'Brave Otter 42' } },
        games: { 'game-1': tree },
        activeGameId: 'game-1',
      },
      leaveRoom(),
    );
    expect(state).toEqual({
      slug: null,
      ops: [],
      presence: {},
      games: {},
      activeGameId: null,
    });
  });

  it('applyOp appends ops with increasing seq', () => {
    let state = roomReducer(undefined, applyOp(moveOp(1)));
    state = roomReducer(state, applyOp(moveOp(2)));
    expect(state.ops.map((o) => o.seq)).toEqual([1, 2]);
  });

  it('applyOp ignores an op with a stale or equal seq', () => {
    let state = roomReducer(undefined, applyOp(moveOp(2)));
    state = roomReducer(state, applyOp(moveOp(2)));
    state = roomReducer(state, applyOp(moveOp(1)));
    expect(state.ops.map((o) => o.seq)).toEqual([2]);
  });

  it('replayOps replaces ops and sorts by seq', () => {
    let state = roomReducer(undefined, applyOp(moveOp(3)));
    state = roomReducer(state, replayOps([cursorOp(2), moveOp(1)]));
    expect(state.ops.map((o) => o.seq)).toEqual([1, 2]);
  });

  it('adds a set_game op to the games map and makes it active when nothing is', () => {
    const op = setGameOp(1, 'Alice');
    const state = roomReducer(undefined, applyOp(op));
    expect(state.games['game-1'].headers.White).toBe('Alice');
    expect(state.activeGameId).toBe('game-1');
    expect(selectActiveGame(state)).toEqual(op.payload.tree);
  });

  it('a set_game echo does not switch the active game when one is already set', () => {
    let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
    state = roomReducer(state, applyOp(setGameOp(2, 'Bob', 'game-2')));
    expect(state.activeGameId).toBe('game-1');
    expect(selectActiveGame(state)?.headers.White).toBe('Alice');
  });

  it('set_game ops without a game_id land in the legacy game', () => {
    const legacy = { ...setGameOp(1, 'Alice') };
    delete legacy.payload.game_id;
    const state = roomReducer(undefined, applyOp(legacy));
    expect(state.games.main.headers.White).toBe('Alice');
    expect(state.activeGameId).toBe('main');
  });

  it('replayOps rebuilds games and selects the newest one', () => {
    const state = roomReducer(
      undefined,
      replayOps([setGameOp(1, 'Alice'), moveOp(2), setGameOp(3, 'Bob', 'game-2')]),
    );
    expect(Object.keys(state.games)).toEqual(['game-1', 'game-2']);
    expect(state.activeGameId).toBe('game-2');
    expect(selectActiveGame(state)?.headers.White).toBe('Bob');
  });

  it('setActiveGame switches the view to a known game and ignores unknown ids', () => {
    let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
    state = roomReducer(state, applyOp(setGameOp(2, 'Bob', 'game-2')));
    state = roomReducer(state, setActiveGame('game-2'));
    expect(state.activeGameId).toBe('game-2');
    state = roomReducer(state, setActiveGame('nope'));
    expect(state.activeGameId).toBe('game-2');
  });

  it('tracks presence members', () => {
    const member = { id: 'author-1', name: 'Brave Otter 42' };
    let state = roomReducer(undefined, joinMember(member));
    expect(state.presence).toEqual({ 'author-1': member });
    state = roomReducer(state, leaveMember({ id: 'author-1' }));
    expect(state.presence).toEqual({});
  });

  describe('presenter selectors', () => {
    const member = { id: 'author-1', name: 'Brave Otter 42' };

    it('selectPresenter returns the last set_game author still in presence', () => {
      let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, joinMember(member));
      expect(selectPresenter(state)).toEqual(member);
    });

    it('selectPresenter is null without a game or when the author left', () => {
      expect(selectPresenter(initialState())).toBeNull();
      let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, joinMember(member));
      state = roomReducer(state, leaveMember({ id: 'author-1' }));
      expect(selectPresenter(state)).toBeNull();
    });

    it('selectPresenterGameId is the presenter import or last selection', () => {
      let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, joinMember(member));
      expect(selectPresenterGameId(state)).toBe('game-1');
      state = roomReducer(state, applyOp(selectOp(2, 'game-2')));
      expect(selectPresenterGameId(state)).toBe('game-2');
    });

    it('selectPresenterGameId follows the newest importer, ignoring other focus ops', () => {
      let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, joinMember(member));
      state = roomReducer(state, applyOp({ ...selectOp(2, 'game-9', 'author-2') }));
      expect(selectPresenterGameId(state)).toBe('game-1');
      state = roomReducer(state, applyOp({ ...setGameOp(3, 'Carol', 'game-3') }));
      expect(selectPresenterGameId(state)).toBe('game-3');
    });

    it('selectPresenterCursor ignores cursors before the presenter focus', () => {
      let state = roomReducer(undefined, applyOp(cursorOp(1)));
      state = roomReducer(state, applyOp(setGameOp(2, 'Alice')));
      state = roomReducer(state, joinMember(member));
      expect(selectPresenterCursor(state)).toBeNull();
    });

    it('selectPresenterCursor ignores cursors from other authors', () => {
      let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, joinMember(member));
      state = roomReducer(state, applyOp({ ...cursorOp(2), author: 'author-2' }));
      expect(selectPresenterCursor(state)).toBeNull();
    });

    it('selectPresenterCursor keeps the last presenter cursor', () => {
      let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, joinMember(member));
      state = roomReducer(state, applyOp(cursorOp(2, 1)));
      state = roomReducer(state, applyOp(cursorOp(3, 5)));
      expect(selectPresenterCursor(state)).toBe(5);
    });

    it('selectPresenterCursor resets when the presenter focuses another game', () => {
      let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, joinMember(member));
      state = roomReducer(state, applyOp(cursorOp(2)));
      state = roomReducer(state, applyOp(selectOp(3, 'game-2')));
      expect(selectPresenterCursor(state)).toBeNull();
      state = roomReducer(state, applyOp(cursorOp(4)));
      expect(selectPresenterCursor(state)).toBe(3);
    });

    it('selectPresenterCursor resets when a new game is imported', () => {
      let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, joinMember(member));
      state = roomReducer(state, applyOp(cursorOp(2)));
      state = roomReducer(state, applyOp(setGameOp(3, 'Bob', 'game-2')));
      expect(selectPresenterCursor(state)).toBeNull();
    });
  });
});
