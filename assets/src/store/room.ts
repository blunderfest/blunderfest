import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GameTree } from '@/lib/api';
import type { Op, PresenceMember, SetGameOp } from '@/protocol/ops';

/**
 * `game_id` for `set_game` ops from before games had ids.
 */
export const LEGACY_GAME_ID = 'main';

export type RoomState = {
  slug: string | null;
  ops: Op[];
  presence: Record<string, PresenceMember>;
  games: Record<string, GameTree>;
  activeGameId: string | null;
};

const initialState: RoomState = {
  slug: null,
  ops: [],
  presence: {},
  games: {},
  activeGameId: null,
};

export function gameIdOf(op: SetGameOp): string {
  return op.payload.game_id ?? LEGACY_GAME_ID;
}

function lastSetGame(ops: Op[]): SetGameOp | null {
  let last: SetGameOp | null = null;
  for (const op of ops) {
    if (op.type === 'set_game') {
      last = op;
    }
  }
  return last;
}

export function selectActiveGame(state: RoomState): GameTree | null {
  if (state.activeGameId === null) {
    return null;
  }
  return state.games[state.activeGameId] ?? null;
}

/**
 * The presenter is the author of the last `set_game` op, as long as they are
 * still in the room. Nobody presents until someone imports a game.
 */
export function selectPresenter(state: RoomState): PresenceMember | null {
  const last = lastSetGame(state.ops);
  if (last === null) {
    return null;
  }
  return state.presence[last.author] ?? null;
}

/**
 * The game the presenter is currently viewing — the target of their last
 * focus op (their own import, or a `select_game` announcing a switch).
 */
export function selectPresenterGameId(state: RoomState): string | null {
  const presenter = selectPresenter(state);
  if (presenter === null) {
    return null;
  }
  let focus: string | null = null;
  for (const op of state.ops) {
    if (op.author !== presenter.id) {
      continue;
    }
    if (op.type === 'set_game') {
      focus = gameIdOf(op);
    }
    if (op.type === 'select_game') {
      focus = op.payload.game_id;
    }
  }
  return focus;
}

/**
 * The presenter's most recent cursor, restricted to ops after the game they
 * are currently viewing — cursor ops from other members, or from a previous
 * game, are ignored.
 */
export function selectPresenterCursor(state: RoomState): number | null {
  const presenter = selectPresenter(state);
  if (presenter === null) {
    return null;
  }
  let focusSeq = -1;
  for (const op of state.ops) {
    if (op.author !== presenter.id) {
      continue;
    }
    if (op.type === 'set_game' || op.type === 'select_game') {
      focusSeq = op.seq;
    }
  }
  let cursor: number | null = null;
  for (const op of state.ops) {
    if (op.seq <= focusSeq) {
      continue;
    }
    if (op.type === 'set_cursor' && op.author === presenter.id) {
      cursor = op.payload.node_id;
    }
  }
  return cursor;
}

const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    enterRoom(state, action: PayloadAction<{ slug: string }>) {
      state.slug = action.payload.slug;
      state.ops = [];
      state.presence = {};
      state.games = {};
      state.activeGameId = null;
    },
    leaveRoom(state) {
      state.slug = null;
      state.ops = [];
      state.presence = {};
      state.games = {};
      state.activeGameId = null;
    },
    applyOp(state, action: PayloadAction<Op>) {
      const op = action.payload;
      const lastSeq = state.ops.length > 0 ? state.ops[state.ops.length - 1].seq : -1;
      if (op.seq > lastSeq) {
        state.ops.push(op);
        if (op.type === 'set_game') {
          const id = gameIdOf(op);
          state.games[id] = op.payload.tree;
          if (state.activeGameId === null) {
            state.activeGameId = id;
          }
        }
      }
    },
    replayOps(state, action: PayloadAction<Op[]>) {
      state.ops = [...action.payload].sort((a, b) => a.seq - b.seq);
      state.games = {};
      let newest: string | null = null;
      for (const op of state.ops) {
        if (op.type === 'set_game') {
          const id = gameIdOf(op);
          state.games[id] = op.payload.tree;
          newest = id;
        }
      }
      state.activeGameId = newest;
    },
    setActiveGame(state, action: PayloadAction<string>) {
      if (state.games[action.payload] !== undefined) {
        state.activeGameId = action.payload;
      }
    },
    joinMember(state, action: PayloadAction<PresenceMember>) {
      state.presence[action.payload.id] = action.payload;
    },
    leaveMember(state, action: PayloadAction<{ id: string }>) {
      delete state.presence[action.payload.id];
    },
  },
});

export const { enterRoom, leaveRoom, applyOp, replayOps, setActiveGame, joinMember, leaveMember } =
  roomSlice.actions;

export default roomSlice.reducer;
