import { describe, expect, it } from 'vitest';
import type { GameNode, GameTree } from '@/lib/api';
import type { CommentAtPlyOp, MemberRole, MoveAtPlyOp, Op, SetGameOp } from '@/protocol/ops';
import roomReducer, {
  applyOp,
  enterRoom,
  joinMember,
  leaveMember,
  leaveRoom,
  replayOps,
  selectActivityOps,
  selectCanEdit,
  selectFirstGameId,
  selectLastPlayed,
  selectPresenter,
  selectPresenterCursor,
  selectPresenterGameId,
  selectRoleOf,
  selectSortedMembers,
  setMemberRole,
  setRoles,
  setupPlyFromFen,
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

function commentAtPly(
  seq: number,
  plyNumber: number,
  text: string,
  payload: Partial<CommentAtPlyOp['payload']> = {},
): Op {
  return {
    seq,
    author: 'author-1',
    ts: '2026-01-01T00:00:00Z',
    type: 'comment_at_ply',
    payload: { game_id: 'game-1', ply: plyNumber, text, ...payload },
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
      names: {},
      roles: {},
      games: {},
      lastPlayed: {},
      annotations: {},
      region: null,
      readOnly: false,
    });
  });

  it('enterRoom sets the slug and clears ops, presence, roles and games', () => {
    const state = roomReducer(
      {
        slug: 'old',
        ops: [moveOp(1)],
        presence: { 'author-1': { id: 'author-1', name: 'Brave Otter 42' } },
        names: { 'author-1': 'Brave Otter 42' },
        roles: { 'author-1': 'owner' },
        games: { 'game-1': tree },
        lastPlayed: { 'game-1': 1 },
        annotations: {},
        region: 'ord',
        readOnly: true,
      },
      enterRoom({ slug: 'room-123' }),
    );
    expect(state).toEqual({
      slug: 'room-123',
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

  it('leaveRoom clears everything', () => {
    const state = roomReducer(
      {
        slug: 'room-123',
        ops: [moveOp(1)],
        presence: { 'author-1': { id: 'author-1', name: 'Brave Otter 42' } },
        names: { 'author-1': 'Brave Otter 42' },
        roles: { 'author-1': 'owner' },
        games: { 'game-1': tree },
        lastPlayed: { 'game-1': 1 },
        annotations: {},
        region: 'ord',
        readOnly: true,
      },
      leaveRoom(),
    );
    expect(state).toEqual({
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

  it('setRoles replaces the role map', () => {
    const state = roomReducer(
      undefined,
      setRoles({ 'author-1': 'owner', 'author-2': 'collaborator' }),
    );
    expect(state.roles).toEqual({ 'author-1': 'owner', 'author-2': 'collaborator' });
  });

  it('setMemberRole updates a single member role', () => {
    let state = roomReducer(undefined, setRoles({ 'author-1': 'owner', 'author-2': 'viewer' }));
    state = roomReducer(state, setMemberRole({ member_id: 'author-2', role: 'collaborator' }));
    expect(state.roles).toEqual({ 'author-1': 'owner', 'author-2': 'collaborator' });
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

  it('adds a set_game op to the games map', () => {
    const op = setGameOp(1, 'Alice');
    const state = roomReducer(undefined, applyOp(op));
    expect(state.games['game-1'].headers.White).toBe('Alice');
    expect(selectFirstGameId(state)).toBe('game-1');
  });

  it('the first imported game stays the default selection', () => {
    let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
    state = roomReducer(state, applyOp(setGameOp(2, 'Bob', 'game-2')));
    expect(selectFirstGameId(state)).toBe('game-1');
  });

  it('set_game ops without a game_id land in the legacy game', () => {
    const legacy = { ...setGameOp(1, 'Alice') };
    delete legacy.payload.game_id;
    const state = roomReducer(undefined, applyOp(legacy));
    expect(state.games.main.headers.White).toBe('Alice');
    expect(selectFirstGameId(state)).toBe('main');
  });

  it('replayOps rebuilds games from the op log', () => {
    const state = roomReducer(
      undefined,
      replayOps([setGameOp(1, 'Alice'), moveOp(2), setGameOp(3, 'Bob', 'game-2')]),
    );
    expect(Object.keys(state.games)).toEqual(['game-1', 'game-2']);
    expect(selectFirstGameId(state)).toBe('game-1');
  });

  it('selectFirstGameId is null without games', () => {
    let state = roomReducer(undefined, applyOp(cursorOp(1)));
    expect(selectFirstGameId(state)).toBeNull();
    state = roomReducer(state, applyOp(moveOp(2)));
    expect(selectFirstGameId(state)).toBeNull();
  });

  it('tracks presence members', () => {
    const member = { id: 'author-1', name: 'Brave Otter 42' };
    let state = roomReducer(undefined, joinMember(member));
    expect(state.presence).toEqual({ 'author-1': member });
    state = roomReducer(state, leaveMember({ id: 'author-1' }));
    expect(state.presence).toEqual({});
  });

  it('selectActivityOps filters out cursor and selection noise', () => {
    let state = roomReducer(undefined, replayOps([cursorOp(1), moveOp(2), selectOp(3, 'game-1')]));
    state = roomReducer(state, applyOp(setGameOp(4, 'Alice')));
    expect(selectActivityOps(state).map((op) => op.seq)).toEqual([2, 4]);
  });

  it('selectRoleOf defaults unknown and anonymous members to viewer', () => {
    const state = roomReducer(
      undefined,
      setRoles({ 'author-1': 'owner', 'author-2': 'collaborator' }),
    );
    expect(selectRoleOf(state, 'author-1')).toBe('owner');
    expect(selectRoleOf(state, 'author-2')).toBe('collaborator');
    expect(selectRoleOf(state, 'unknown')).toBe('viewer');
    expect(selectRoleOf(state, null)).toBe('viewer');
  });

  it('selectCanEdit is true for owners and collaborators only', () => {
    const state = roomReducer(
      undefined,
      setRoles({ 'author-1': 'owner', 'author-2': 'collaborator' }),
    );
    expect(selectCanEdit(state, 'author-1')).toBe(true);
    expect(selectCanEdit(state, 'author-2')).toBe(true);
    expect(selectCanEdit(state, 'author-3')).toBe(false);
    expect(selectCanEdit(state, null)).toBe(false);
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

    it('attaches moves to the parent named by parent_id, so variations continue in place', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      // 1... c5 as an alternative to 1... e5 (parent is the e4 node, id 1)
      state = roomReducer(state, applyOp(moveAtPly(2, 2, { san: 'c5', parent_id: 1 })));
      // 2. d4 continues the c5 variation (parent is the c5 node, id 3)
      state = roomReducer(state, applyOp(moveAtPly(3, 3, { san: 'd4', parent_id: 3 })));

      const game = state.games['game-1'];
      const e4 = game.root.children[0];
      const c5 = e4.children[1];
      expect(c5).toMatchObject({ id: 3, ply: 2, san: 'c5' });
      expect(c5.children[0]).toMatchObject({ id: 4, ply: 3, san: 'd4' });
      // The mainline (e4 e5) is untouched and still ends at e5.
      expect(e4.children[0].children).toEqual([]);
      expect(game.mainline_ply_count).toBe(2);
    });

    it('extends the mainline when parent_id names the mainline tip', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(
        state,
        applyOp(moveAtPly(2, 3, { san: 'Nf3', from: 'g1', to: 'f3', parent_id: 2 })),
      );

      const game = state.games['game-1'];
      expect(game.root.children[0].children[0].children[0]).toMatchObject({
        id: 3,
        san: 'Nf3',
      });
      expect(game.mainline_ply_count).toBe(3);
    });

    it('does not set the game result from a mate inside a variation', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(moveAtPly(2, 2, { san: 'c5', parent_id: 1 })));
      state = roomReducer(
        state,
        applyOp(moveAtPly(3, 3, { san: 'Qh4#', status: 'checkmate', parent_id: 3 })),
      );

      expect(state.games['game-1'].result).toBe('*');
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

  describe('comment_at_ply transforms', () => {
    it('sets a comment on the mainline node at the given ply', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(commentAtPly(2, 1, 'Strong move!')));

      const move = state.games['game-1'].root.children[0];
      expect(move.comment).toBe('Strong move!');
    });

    it('an empty text clears the comment', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(commentAtPly(2, 1, 'Strong move!')));
      state = roomReducer(state, applyOp(commentAtPly(3, 1, '')));

      const move = state.games['game-1'].root.children[0];
      expect(move.comment).toBeNull();
    });

    it('targets variation nodes by node_id instead of the mainline ply', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      // 1... c5 as a variation of e4 (id 3), then comment on it by node id.
      state = roomReducer(state, applyOp(moveAtPly(2, 2, { san: 'c5', parent_id: 1 })));
      state = roomReducer(state, applyOp(commentAtPly(3, 2, 'The Sicilian!', { node_id: 3 })));

      const game = state.games['game-1'];
      const e4 = game.root.children[0];
      expect(e4.children[1].comment).toBe('The Sicilian!');
      // The mainline node at that ply (e5) stays uncommented.
      expect(e4.children[0].comment).toBeNull();
    });

    it('comments on setup nodes by node_id', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(
        state,
        applyOp({
          seq: 2,
          author: 'author-1',
          ts: '2026-01-01T00:00:00Z',
          type: 'set_position',
          payload: {
            game_id: 'game-1',
            parent_id: 2,
            fen: 'rnbqkbnr/pppp1ppp/8/4p2P/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2',
          },
        }),
      );
      state = roomReducer(state, applyOp(commentAtPly(3, 3, 'pawn to h3, see?', { node_id: 3 })));

      const setup = state.games['game-1'].root.children[0].children[0].children[0];
      expect(setup.comment).toBe('pawn to h3, see?');
    });

    it('ignores comments whose node_id does not exist', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(commentAtPly(2, 1, 'x', { node_id: 999 })));
      expect(state.games['game-1'].root.children[0].comment).toBeNull();
    });

    it('ignores comments for plies beyond the mainline and unknown games', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(commentAtPly(2, 99, 'x')));
      expect(state.games['game-1'].root.children[0].comment).toBeNull();

      state = roomReducer(state, applyOp(commentAtPly(3, 1, 'x', { game_id: 'nope' })));
      expect(state.games['game-1'].root.children[0].comment).toBeNull();
    });

    it('applies comments in seq order during replay', () => {
      const state = roomReducer(
        undefined,
        replayOps([commentAtPly(2, 1, 'Nice'), playedGameOp(1)]),
      );

      expect(state.games['game-1'].root.children[0].comment).toBe('Nice');

      const next = roomReducer(state, applyOp(commentAtPly(3, 1, 'Risky')));
      expect(next.games['game-1'].root.children[0].comment).toBe('Risky');
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

  describe('selectSortedMembers', () => {
    function stateWith(roles: Record<string, MemberRole>): ReturnType<typeof initialState> {
      let state = roomReducer(undefined, setRoles(roles));
      state = roomReducer(state, joinMember({ id: 'owner', name: 'Proud Raven 65' }));
      state = roomReducer(state, joinMember({ id: 'collab-b', name: 'Brave Otter 42' }));
      state = roomReducer(state, joinMember({ id: 'collab-a', name: 'Swift Falcon 17' }));
      state = roomReducer(state, joinMember({ id: 'viewer', name: 'Zeta Zulu 77' }));
      return state;
    }

    it('sorts owners, then collaborators, then viewers, each by name', () => {
      const state = stateWith({
        owner: 'owner',
        'collab-a': 'collaborator',
        'collab-b': 'collaborator',
        viewer: 'viewer',
      });
      expect(selectSortedMembers(state).map((m) => m.id)).toEqual([
        'owner',
        'collab-b',
        'collab-a',
        'viewer',
      ]);
    });

    it('treats members without a role as viewers', () => {
      const state = stateWith({ owner: 'owner' });
      expect(selectSortedMembers(state).map((m) => m.id)).toEqual([
        'owner',
        'collab-b',
        'collab-a',
        'viewer',
      ]);
    });
  });
});

describe('set_position transforms', () => {
  it('appends a setup node under the parent with the FEN-derived ply', () => {
    let state = roomReducer(undefined, applyOp(playedGameOp(1)));
    state = roomReducer(
      state,
      applyOp({
        seq: 2,
        author: 'author-1',
        ts: '2026-01-01T00:00:00Z',
        type: 'set_position',
        payload: {
          game_id: 'game-1',
          parent_id: 2,
          fen: 'rnbqkbnr/pppp1ppp/8/4p2P/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2',
        },
      }),
    );

    const game = state.games['game-1'];
    const e5 = game.root.children[0].children[0];
    const setup = e5.children[0];
    expect(setup).toMatchObject({ id: 3, ply: 3, san: null });
    expect(setup.fen).toContain('4p2P');
    expect(game.node_count).toBe(4);
    expect(game.mainline_ply_count).toBe(2);
    expect(game.result).toBe('*');
  });

  it('derives the setup ply so black-to-move setups number correctly', () => {
    expect(setupPlyFromFen('8/8/8/8/8/8/4K3/4k3 w - - 0 20')).toBe(38);
    expect(setupPlyFromFen('8/8/8/8/8/8/4K3/4k3 b - - 0 20')).toBe(39);
    expect(setupPlyFromFen('garbage')).toBeNull();
  });
});

describe('lastPlayed tracking', () => {
  it('points at the node created by the latest move op, even in a variation', () => {
    let state = roomReducer(undefined, applyOp(playedGameOp(1)));
    expect(selectLastPlayed(state, 'game-1')).toBeNull();

    state = roomReducer(state, applyOp(moveAtPly(2, 3, { san: 'Nf3', parent_id: 2 })));
    expect(selectLastPlayed(state, 'game-1')).toBe(3);

    // A variation move is "last played" too.
    state = roomReducer(state, applyOp(moveAtPly(3, 2, { san: 'c5', parent_id: 1 })));
    expect(selectLastPlayed(state, 'game-1')).toBe(4);
  });

  it('tracks the newest move across a replay', () => {
    const state = roomReducer(
      undefined,
      replayOps([
        playedGameOp(1),
        moveAtPly(2, 3, { san: 'Nf3', parent_id: 2 }),
        moveAtPly(3, 2, { san: 'c5', parent_id: 1 }),
      ]),
    );
    expect(selectLastPlayed(state, 'game-1')).toBe(4);
  });
});

describe('set_annotations transforms', () => {
  const arrow = { from: 'e2', to: 'e4', color: '#3b82f6' };
  const highlight = { square: 'e4', color: '#e05a4e' };

  function annotationOp(seq: number, arrows = [arrow], highlights = [highlight]): Op {
    return {
      seq,
      author: 'author-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_annotations',
      payload: { game_id: 'game-1', node_id: 1, arrows, highlights },
    };
  }

  it('stores annotations per node and replaces them wholesale', () => {
    let state = roomReducer(undefined, applyOp(playedGameOp(1)));
    state = roomReducer(state, applyOp(annotationOp(2)));
    expect(state.annotations['game-1'][1]).toEqual({ arrows: [arrow], highlights: [highlight] });

    state = roomReducer(state, applyOp(annotationOp(3, [arrow], [])));
    expect(state.annotations['game-1'][1]).toEqual({ arrows: [arrow], highlights: [] });
  });

  it('replays annotations', () => {
    const state = roomReducer(undefined, replayOps([playedGameOp(1), annotationOp(2)]));
    expect(state.annotations['game-1'][1].highlights).toEqual([highlight]);
  });
});
