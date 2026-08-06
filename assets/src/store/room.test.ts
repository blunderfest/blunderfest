import { describe, expect, it } from 'vitest';
import type { GameNode, GameTree } from '@/lib/api';
import type { MoveAtPlyOp, Op, SetGameOp } from '@/protocol/ops';
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
  setMemberRole,
  setRoles,
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

function moveOp(seq: number, ply = 1, gameId = 'game-1'): Op {
  return {
    seq,
    author: 'author-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'move_at_ply',
    payload: {
      game_id: gameId,
      ply,
      san: 'e4',
      from: 'e2',
      to: 'e4',
      promotion: null,
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      status: 'active',
    },
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

function setGameOp(seq: number, white: string, gameId = 'game-1', author = 'author-1'): SetGameOp {
  return {
    seq,
    author,
    ts: '2026-01-01T00:00:00Z',
    type: 'set_game',
    payload: {
      game_id: gameId,
      tree: { ...tree, headers: { White: white } },
    },
  };
}

function ply(partial: Partial<GameNode>): GameNode {
  return {
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
    ...partial,
  };
}

const playedTree: GameTree = {
  headers: {},
  result: '*',
  setup: null,
  mainline_ply_count: 2,
  node_count: 3,
  root: ply({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    children: [
      ply({
        id: 1,
        ply: 1,
        san: 'e4',
        from: 'e2',
        to: 'e4',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        children: [
          ply({
            id: 2,
            ply: 2,
            san: 'e5',
            from: 'e7',
            to: 'e5',
            fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
          }),
        ],
      }),
    ],
  }),
};

function playedGameOp(seq: number): SetGameOp {
  return {
    seq,
    author: 'author-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'set_game',
    payload: { game_id: 'game-1', tree: playedTree },
  };
}

function moveAtPly(
  seq: number,
  plyNumber: number,
  payload: Partial<MoveAtPlyOp['payload']> = {},
): Op {
  return {
    seq,
    author: 'author-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'move_at_ply',
    payload: {
      game_id: 'game-1',
      ply: plyNumber,
      san: 'e4',
      from: 'e2',
      to: 'e4',
      promotion: null,
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      status: 'active',
      ...payload,
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
      roles: {},
      games: {},
      activeGameId: null,
    });
  });

  it('enterRoom sets the slug and clears ops, presence, roles and games', () => {
    const state = roomReducer(
      {
        slug: 'old',
        ops: [moveOp(1)],
        presence: { 'author-1': { id: 'author-1', name: 'Brave Otter 42' } },
        roles: { 'author-1': 'owner' },
        games: { 'game-1': tree },
        activeGameId: 'game-1',
      },
      enterRoom({ slug: 'room-123' }),
    );
    expect(state).toEqual({
      slug: 'room-123',
      ops: [],
      presence: {},
      roles: {},
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
        roles: { 'author-1': 'owner' },
        games: { 'game-1': tree },
        activeGameId: 'game-1',
      },
      leaveRoom(),
    );
    expect(state).toEqual({
      slug: null,
      ops: [],
      presence: {},
      roles: {},
      games: {},
      activeGameId: null,
    });
  });

  it('setRoles replaces the role map', () => {
    const state = roomReducer(undefined, setRoles({ 'author-1': 'owner', 'author-2': 'partner' }));
    expect(state.roles).toEqual({ 'author-1': 'owner', 'author-2': 'partner' });
  });

  it('setMemberRole updates a single member role', () => {
    let state = roomReducer(undefined, setRoles({ 'author-1': 'owner', 'author-2': 'viewer' }));
    state = roomReducer(state, setMemberRole({ member_id: 'author-2', role: 'partner' }));
    expect(state.roles).toEqual({ 'author-1': 'owner', 'author-2': 'partner' });
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

  describe('move_at_ply transforms', () => {
    it('appends a move beyond the end of the mainline', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(moveAtPly(2, 3, { san: 'Nf3', from: 'g1', to: 'f3' })));

      const game = state.games['game-1'];
      expect(game.mainline_ply_count).toBe(3);
      expect(game.node_count).toBe(4);

      const last = game.root.children[0].children[0].children[0];
      expect(last).toMatchObject({ id: 3, ply: 3, san: 'Nf3', from: 'g1', to: 'f3' });
    });

    it('inserts a mid-line move as a variation', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(moveAtPly(2, 2, { san: 'Nc3', from: 'b1', to: 'c3' })));

      const game = state.games['game-1'];
      expect(game.mainline_ply_count).toBe(2);
      expect(game.node_count).toBe(4);
      expect(game.root.children[0].children.map((c) => c.san)).toEqual(['e5', 'Nc3']);
      expect(game.root.children[0].children[1]).toMatchObject({ id: 3, ply: 2, san: 'Nc3' });
    });

    it('sets the result from the final status', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(moveAtPly(2, 3, { san: 'Qh4#', status: 'checkmate' })));
      expect(state.games['game-1'].result).toBe('1-0');

      state = roomReducer(state, applyOp(moveAtPly(3, 4, { san: 'Qxf7#', status: 'checkmate' })));
      expect(state.games['game-1'].result).toBe('0-1');
    });

    it('applies move ops in seq order during replay', () => {
      const state = roomReducer(
        undefined,
        replayOps([moveAtPly(2, 3, { san: 'Nf3', from: 'g1', to: 'f3' }), playedGameOp(1)]),
      );

      const game = state.games['game-1'];
      expect(game.root.children[0].children[0].children[0]).toMatchObject({
        id: 3,
        san: 'Nf3',
      });

      const next = roomReducer(
        state,
        applyOp(moveAtPly(3, 4, { san: 'Nc6', from: 'b8', to: 'c6' })),
      );
      expect(
        next.games['game-1'].root.children[0].children[0].children[0].children[0],
      ).toMatchObject({
        id: 4,
        san: 'Nc6',
      });
    });

    it('ignores move ops for unknown games and legacy payloads without game_id', () => {
      let state = roomReducer(undefined, applyOp(moveAtPly(1, 3, { game_id: 'nope' })));
      expect(state.games).toEqual({});

      const legacy = moveAtPly(2, 3) as Op & { payload: { game_id?: string } };
      delete legacy.payload.game_id;
      state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(legacy));

      const game = state.games['game-1'];
      expect(game.mainline_ply_count).toBe(2);
      expect(game.node_count).toBe(3);
    });
  });

  describe('presenter selectors', () => {
    const member = { id: 'author-1', name: 'Brave Otter 42' };

    function ownerState() {
      let state = roomReducer(undefined, setRoles({ 'author-1': 'owner' }));
      state = roomReducer(state, joinMember(member));
      return state;
    }

    it('selectPresenter returns the room owner still in presence', () => {
      const state = ownerState();
      expect(selectPresenter(state)).toEqual(member);
    });

    it('selectPresenter is null without an owner or when the owner left', () => {
      expect(selectPresenter(initialState())).toBeNull();

      let state = roomReducer(undefined, setRoles({ 'author-1': 'owner' }));
      state = roomReducer(state, joinMember(member));
      state = roomReducer(state, leaveMember({ id: 'author-1' }));
      expect(selectPresenter(state)).toBeNull();
    });

    it('selectPresenter is null while the owner role is held by nobody in presence', () => {
      const state = roomReducer(undefined, setRoles({ 'author-9': 'owner' }));
      expect(selectPresenter(state)).toBeNull();
    });

    it('selectPresenterGameId is the owner import or last owner selection', () => {
      let state = ownerState();
      state = roomReducer(state, applyOp(setGameOp(1, 'Alice')));
      expect(selectPresenterGameId(state)).toBe('game-1');
      state = roomReducer(state, applyOp(selectOp(2, 'game-2')));
      expect(selectPresenterGameId(state)).toBe('game-2');
    });

    it('selectPresenterGameId ignores other members focus ops', () => {
      let state = ownerState();
      state = roomReducer(state, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, applyOp({ ...selectOp(2, 'game-9', 'author-2') }));
      expect(selectPresenterGameId(state)).toBe('game-1');
      state = roomReducer(state, applyOp({ ...setGameOp(3, 'Carol', 'game-3', 'author-2') }));
      expect(selectPresenterGameId(state)).toBe('game-1');
    });

    it('selectPresenterGameId falls back to the newest import when the owner has none', () => {
      let state = ownerState();
      state = roomReducer(state, applyOp({ ...setGameOp(1, 'Alice', 'game-1', 'author-2') }));
      expect(selectPresenterGameId(state)).toBe('game-1');
      state = roomReducer(state, applyOp({ ...setGameOp(2, 'Bob', 'game-2', 'author-2') }));
      expect(selectPresenterGameId(state)).toBe('game-2');
    });

    it('selectPresenterCursor ignores cursors before the presenter focus', () => {
      let state = ownerState();
      state = roomReducer(state, applyOp(cursorOp(1)));
      state = roomReducer(state, applyOp(setGameOp(2, 'Alice')));
      expect(selectPresenterCursor(state)).toBeNull();
    });

    it('selectPresenterCursor ignores cursors from other authors', () => {
      let state = ownerState();
      state = roomReducer(state, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, applyOp({ ...cursorOp(2), author: 'author-2' }));
      expect(selectPresenterCursor(state)).toBeNull();
    });

    it('selectPresenterCursor keeps the last presenter cursor', () => {
      let state = ownerState();
      state = roomReducer(state, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, applyOp(cursorOp(2, 1)));
      state = roomReducer(state, applyOp(cursorOp(3, 5)));
      expect(selectPresenterCursor(state)).toBe(5);
    });

    it('selectPresenterCursor resets when the presenter focuses another game', () => {
      let state = ownerState();
      state = roomReducer(state, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, applyOp(cursorOp(2)));
      state = roomReducer(state, applyOp(selectOp(3, 'game-2')));
      expect(selectPresenterCursor(state)).toBeNull();
      state = roomReducer(state, applyOp(cursorOp(4)));
      expect(selectPresenterCursor(state)).toBe(3);
    });

    it('selectPresenterCursor resets when a new game is imported', () => {
      let state = ownerState();
      state = roomReducer(state, applyOp(setGameOp(1, 'Alice')));
      state = roomReducer(state, applyOp(cursorOp(2)));
      state = roomReducer(state, applyOp(setGameOp(3, 'Bob', 'game-2')));
      expect(selectPresenterCursor(state)).toBeNull();
    });
  });
});
