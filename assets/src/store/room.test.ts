import { describe, expect, it } from 'vitest';
import type { GameNode, GameTree } from '@/lib/api';
import type {
  AddLineOp,
  AnalysisEval,
  CommentAtPlyOp,
  MemberRole,
  MoveAtPlyOp,
  Op,
  SetGameOp,
} from '@/protocol/ops';
import roomReducer, {
  applyOp,
  enterRoom,
  leaveRoom,
  replayOps,
  selectCanEdit,
  selectEvidenceGids,
  selectFirstGameId,
  selectLastPlayed,
  selectLastPlayedBy,
  selectPresenter,
  selectPresenterCursor,
  selectPresenterGameId,
  selectRoleOf,
  selectSortedMembers,
  setMemberRole,
  setRoles,
  setupPlyFromFen,
  syncMembers,
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
      lastPlayedBy: {},
      annotations: {},
      region: null,
      readOnly: false,
      analysis: {},
      roomRegion: null,
      lagMs: null,
      presenterId: null,
      analysisProgress: null,
      chatMessages: [],
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
        lastPlayedBy: { 'game-1': 'author-1' },
        annotations: {},
        region: 'ord',
        readOnly: true,
        analysis: {},
        roomRegion: null,
        lagMs: null,
        presenterId: null,
        analysisProgress: null,
        chatMessages: [],
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
      lastPlayedBy: {},
      annotations: {},
      region: null,
      readOnly: false,
      analysis: {},
      roomRegion: null,
      lagMs: null,
      presenterId: null,
      analysisProgress: null,
      chatMessages: [],
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
        lastPlayedBy: { 'game-1': 'author-1' },
        annotations: {},
        region: 'ord',
        readOnly: true,
        analysis: {},
        roomRegion: null,
        lagMs: null,
        presenterId: null,
        analysisProgress: null,
        chatMessages: [],
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
      lastPlayedBy: {},
      annotations: {},
      region: null,
      readOnly: false,
      analysis: {},
      roomRegion: null,
      lagMs: null,
      presenterId: null,
      analysisProgress: null,
      chatMessages: [],
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
    let state = roomReducer(undefined, syncMembers([member]));
    expect(state.presence).toEqual({ 'author-1': member });
    state = roomReducer(state, syncMembers([]));
    expect(state.presence).toEqual({});
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

    it('ignores move ops for unknown games', () => {
      const state = roomReducer(undefined, applyOp(moveAtPly(1, 3, { game_id: 'nope' })));
      expect(state.games).toEqual({});
    });
  });

  describe('add_line transforms', () => {
    function lineMove(partial: Partial<AddLineOp['payload']['moves'][number]> = {}) {
      return {
        san: 'c5',
        from: 'c7',
        to: 'c5',
        promotion: null,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        status: 'active',
        ...partial,
      };
    }

    function addLine(seq: number, parentId: number, moves: AddLineOp['payload']['moves']): Op {
      return {
        seq,
        author: 'author-1',
        ts: '2026-01-01T00:00:00Z',
        type: 'add_line',
        payload: { game_id: 'game-1', parent_id: parentId, moves },
      };
    }

    it('inserts a line as a variation under the named parent', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(
        state,
        applyOp(
          addLine(2, 1, [
            lineMove({ san: 'c5', from: 'c7', to: 'c5' }),
            lineMove({ san: 'd4', from: 'd2', to: 'd4' }),
          ]),
        ),
      );

      const game = state.games['game-1'];
      const e4 = game.root.children[0];
      expect(e4.children.map((c) => c.san)).toEqual(['e5', 'c5']);
      const c5 = e4.children[1];
      expect(c5).toMatchObject({ id: 3, ply: 2, san: 'c5' });
      expect(c5.children[0]).toMatchObject({ id: 4, ply: 3, san: 'd4' });
      expect(game.mainline_ply_count).toBe(2);
      expect(game.node_count).toBe(5);
    });

    it('descends into existing children instead of duplicating them', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(
        state,
        applyOp(
          addLine(2, 1, [
            lineMove({ san: 'e5', from: 'e7', to: 'e5' }),
            lineMove({ san: 'Nc6', from: 'b8', to: 'c6' }),
          ]),
        ),
      );

      const game = state.games['game-1'];
      const e4 = game.root.children[0];
      expect(e4.children).toHaveLength(1);
      expect(e4.children[0].children[0]).toMatchObject({ id: 3, ply: 3, san: 'Nc6' });
      expect(game.node_count).toBe(4);
    });

    it('extends the mainline (and the result) when the parent is the tip', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(
        state,
        applyOp(
          addLine(2, 2, [
            lineMove({ san: 'Qh5', from: 'd1', to: 'h5' }),
            lineMove({ san: 'Nc6', from: 'b8', to: 'c6' }),
            lineMove({ san: 'Qxf7#', from: 'h5', to: 'f7', status: 'checkmate' }),
          ]),
        ),
      );

      const game = state.games['game-1'];
      expect(game.mainline_ply_count).toBe(5);
      expect(game.result).toBe('1-0');
      const e5 = game.root.children[0].children[0];
      expect(e5.children[0].children[0].children[0]).toMatchObject({
        id: 5,
        ply: 5,
        san: 'Qxf7#',
      });
      // lastPlayed points at the line's end node.
      expect(state.lastPlayed['game-1']).toBe(5);
    });

    it('ignores empty lines and unknown parents', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(addLine(2, 1, [])));
      state = roomReducer(state, applyOp(addLine(3, 99, [lineMove()])));

      expect(state.games['game-1'].node_count).toBe(3);
    });
  });

  describe('set_analysis merging', () => {
    function analysisOp(seq: number, evals: AnalysisEval[], gameId = 'game-1'): Op {
      return {
        seq,
        author: 'Blunderfest',
        ts: '2026-01-01T00:00:00Z',
        type: 'set_analysis',
        payload: { game_id: gameId, depth: 12, evals },
      };
    }

    it('a line analysis merges into the game instead of clobbering the mainline', () => {
      let state = roomReducer(
        undefined,
        applyOp(
          analysisOp(1, [
            { ply: 0, score: { cp: 20 }, best_move: null },
            { ply: 1, score: { cp: 30 }, best_move: null },
          ]),
        ),
      );
      state = roomReducer(
        state,
        applyOp(analysisOp(2, [{ ply: 2, score: { cp: -100 }, best_move: null, node_id: 42 }])),
      );

      expect(state.analysis['game-1'].evals).toHaveLength(3);
    });

    it('a re-run overrides its own positions but keeps other nodes', () => {
      let state = roomReducer(
        undefined,
        applyOp(
          analysisOp(1, [
            { ply: 0, score: { cp: 20 }, best_move: null },
            { ply: 1, score: { cp: 30 }, best_move: null },
          ]),
        ),
      );
      state = roomReducer(
        state,
        applyOp(analysisOp(2, [{ ply: 2, score: { cp: -100 }, best_move: null, node_id: 42 }])),
      );
      // The mainline re-run: same ply keys, fresh scores.
      state = roomReducer(
        state,
        applyOp(
          analysisOp(3, [
            { ply: 0, score: { cp: 50 }, best_move: null },
            { ply: 1, score: { cp: 60 }, best_move: null },
          ]),
        ),
      );

      const evals = state.analysis['game-1'].evals;
      expect(evals).toHaveLength(3);
      expect(evals.find((e) => e.ply === 0)?.score).toEqual({ cp: 50 });
      expect(evals.find((e) => e.node_id === 42)?.score).toEqual({ cp: -100 });
    });

    it('replay merges in op order', () => {
      const state = roomReducer(
        undefined,
        replayOps([
          analysisOp(1, [{ ply: 0, score: { cp: 20 }, best_move: null }]),
          analysisOp(2, [{ ply: 1, score: { cp: -80 }, best_move: null, node_id: 7 }]),
        ]),
      );

      expect(state.analysis['game-1'].evals).toHaveLength(2);
    });
  });

  describe('chat ops', () => {
    function chatOp(seq: number, text: string, author = 'author-1'): Op {
      return {
        seq,
        author,
        ts: '2026-01-01T00:00:00Z',
        type: 'chat',
        payload: { text },
      };
    }

    it('appends chat messages in order and replays them', () => {
      let state = roomReducer(undefined, applyOp(chatOp(1, 'first')));
      state = roomReducer(state, applyOp(chatOp(2, 'second', 'author-2')));

      expect(state.chatMessages.map((m) => m.text)).toEqual(['first', 'second']);
      expect(state.chatMessages[1].author).toBe('author-2');

      const replayed = roomReducer(undefined, replayOps([chatOp(1, 'first'), chatOp(2, 'second')]));
      expect(replayed.chatMessages.map((m) => m.text)).toEqual(['first', 'second']);
    });

    it('caps the history at 200 messages', () => {
      let state = roomReducer(
        undefined,
        replayOps(Array.from({ length: 210 }, (_, i) => chatOp(i + 1, `msg ${i + 1}`))),
      );
      expect(state.chatMessages).toHaveLength(200);
      expect(state.chatMessages[0].text).toBe('msg 11');

      state = roomReducer(state, applyOp(chatOp(211, 'latest')));
      expect(state.chatMessages).toHaveLength(200);
      expect(state.chatMessages[state.chatMessages.length - 1].text).toBe('latest');
    });

    function deleteChatOp(seq: number, targetSeq: number): Op {
      return {
        seq,
        author: 'author-1',
        ts: '2026-01-01T00:00:01Z',
        type: 'delete_chat',
        payload: { seq: targetSeq },
      };
    }

    it('removes a message when its delete_chat op arrives (ADR-0023)', () => {
      let state = roomReducer(undefined, applyOp(chatOp(1, 'first')));
      state = roomReducer(state, applyOp(chatOp(2, 'inappropriate')));
      state = roomReducer(state, applyOp(deleteChatOp(3, 2)));

      expect(state.chatMessages.map((m) => m.text)).toEqual(['first']);
      // The ops themselves stay in the log — deletion is a view filter.
      expect(state.ops.map((op) => op.type)).toEqual(['chat', 'chat', 'delete_chat']);
    });

    it('hides deleted messages on replay', () => {
      const state = roomReducer(
        undefined,
        replayOps([chatOp(1, 'first'), chatOp(2, 'inappropriate'), deleteChatOp(3, 2)]),
      );

      expect(state.chatMessages.map((m) => m.text)).toEqual(['first']);
    });

    it('ignores a delete_chat naming an unknown or already-dropped seq', () => {
      let state = roomReducer(undefined, applyOp(chatOp(1, 'first')));
      state = roomReducer(state, applyOp(deleteChatOp(2, 99)));

      expect(state.chatMessages.map((m) => m.text)).toEqual(['first']);
    });
  });

  describe('remove_game transforms', () => {
    function removeGameOp(seq: number, gameId: string, author = 'author-1'): Op {
      return {
        seq,
        author,
        ts: '2026-01-01T00:00:00Z',
        type: 'remove_game',
        payload: { game_id: gameId },
      };
    }

    it('drops the game and its per-game state; the op log keeps the history', () => {
      let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice', 'game-1')));
      state = roomReducer(state, applyOp(setGameOp(2, 'Bob', 'game-2')));
      state = roomReducer(state, applyOp(moveOp(3, 1, 'game-1')));
      state = roomReducer(state, applyOp(removeGameOp(4, 'game-1')));

      expect(state.games['game-1']).toBeUndefined();
      expect(state.games['game-2']).toBeDefined();
      expect(state.lastPlayed['game-1']).toBeUndefined();
      // The ops themselves stay in the log — removal is a view filter.
      expect(state.ops.map((op) => op.type)).toContain('remove_game');
      // The next remaining game becomes the default selection.
      expect(selectFirstGameId(state)).toBe('game-2');
    });

    it('keeps the game removed on replay (the filter survives a rejoin)', () => {
      const state = roomReducer(
        undefined,
        replayOps([
          setGameOp(1, 'Alice', 'game-1'),
          setGameOp(2, 'Bob', 'game-2'),
          removeGameOp(3, 'game-1'),
        ]),
      );

      expect(state.games['game-1']).toBeUndefined();
      expect(state.games['game-2']).toBeDefined();
      expect(selectFirstGameId(state)).toBe('game-2');
    });

    it('ignores a remove_game naming an unknown game', () => {
      let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice', 'game-1')));
      state = roomReducer(state, applyOp(removeGameOp(2, 'nope')));

      expect(state.games['game-1']).toBeDefined();
    });
  });

  describe('set_nags transforms', () => {
    function setNags(seq: number, nodeId: number, nags: number[], gameId = 'game-1'): Op {
      return {
        seq,
        author: 'author-1',
        ts: '2026-01-01T00:00:00Z',
        type: 'set_nags',
        payload: { game_id: gameId, node_id: nodeId, nags },
      };
    }

    it('sets and clears a node’s nags', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(setNags(2, 1, [1])));

      expect(state.games['game-1'].root.children[0].nags).toEqual([1]);

      state = roomReducer(state, applyOp(setNags(3, 1, [])));
      expect(state.games['game-1'].root.children[0].nags).toEqual([]);
    });

    it('ignores nags for unknown nodes or games', () => {
      let state = roomReducer(undefined, applyOp(playedGameOp(1)));
      state = roomReducer(state, applyOp(setNags(2, 99, [1])));
      expect(state.games['game-1'].root.children[0].nags).toEqual([]);

      state = roomReducer(state, applyOp(setNags(3, 1, [1], 'nope')));
      expect(state.games['game-1'].root.children[0].nags).toEqual([]);
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
      state = roomReducer(state, syncMembers([member]));
      return state;
    }

    it('selectPresenter returns the room owner still in presence', () => {
      const state = ownerState();
      expect(selectPresenter(state)).toEqual(member);
    });

    it('selectPresenter is null without an owner or when the owner left', () => {
      expect(selectPresenter(initialState())).toBeNull();

      let state = roomReducer(undefined, setRoles({ 'author-1': 'owner' }));
      state = roomReducer(state, syncMembers([member]));
      state = roomReducer(state, syncMembers([]));
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
      state = roomReducer(state, applyOp(setGameOp(2, 'Bob', 'game-2')));
      state = roomReducer(state, applyOp(selectOp(3, 'game-2')));
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
      state = roomReducer(
        state,
        syncMembers([
          { id: 'owner', name: 'Proud Raven 65' },
          { id: 'collab-b', name: 'Brave Otter 42' },
          { id: 'collab-a', name: 'Swift Falcon 17' },
          { id: 'viewer', name: 'Zeta Zulu 77' },
        ]),
      );
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

  it('tracks who played last, for the follow-the-tail filter', () => {
    let state = roomReducer(undefined, applyOp(playedGameOp(1)));
    expect(selectLastPlayedBy(state, 'game-1')).toBeNull();

    state = roomReducer(state, applyOp(moveAtPly(2, 3, { san: 'Nf3', parent_id: 2 })));
    expect(selectLastPlayedBy(state, 'game-1')).toBe('author-1');

    // A different member's play becomes the author of record.
    state = roomReducer(
      state,
      applyOp({ ...moveAtPly(3, 2, { san: 'c5', parent_id: 1 }), author: 'author-2' }),
    );
    expect(selectLastPlayedBy(state, 'game-1')).toBe('author-2');

    const replayed = roomReducer(undefined, replayOps([playedGameOp(1), moveAtPly(2, 3)]));
    expect(selectLastPlayedBy(replayed, 'game-1')).toBe('author-1');
  });
});

describe('evidence gid tracking', () => {
  it('derives the in-room corpus gids from set_game ops, across a replay', () => {
    let state = roomReducer(undefined, applyOp(setGameOp(1, 'Alice')));
    expect(selectEvidenceGids(state)).toEqual(new Set());

    state = roomReducer(
      state,
      applyOp({
        ...setGameOp(2, 'Bob', 'game-2'),
        payload: {
          game_id: 'game-2',
          tree: setGameOp(2, 'Bob', 'game-2').payload.tree,
          evidence_gid: 7,
        },
      }),
    );
    expect(selectEvidenceGids(state)).toEqual(new Set([7]));

    const replayed = roomReducer(
      undefined,
      replayOps([
        setGameOp(1, 'Alice'),
        {
          ...setGameOp(2, 'Bob', 'game-2'),
          payload: {
            game_id: 'game-2',
            tree: setGameOp(2, 'Bob', 'game-2').payload.tree,
            evidence_gid: 7,
          },
        },
        {
          ...setGameOp(3, 'Carol', 'game-3'),
          payload: {
            game_id: 'game-3',
            tree: setGameOp(3, 'Carol', 'game-3').payload.tree,
            evidence_gid: 9,
          },
        },
      ]),
    );
    expect(selectEvidenceGids(replayed)).toEqual(new Set([7, 9]));
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
