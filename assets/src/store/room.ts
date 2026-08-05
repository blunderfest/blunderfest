import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GameTree } from '@/lib/api';
import type { Op, PresenceMember, SetGameOp } from '@/protocol/ops';

export type RoomState = {
  slug: string | null;
  ops: Op[];
  presence: Record<string, PresenceMember>;
  game: GameTree | null;
};

const initialState: RoomState = {
  slug: null,
  ops: [],
  presence: {},
  game: null,
};

function gameFromOps(ops: Op[]): GameTree | null {
  const setGames = ops.filter((op) => op.type === 'set_game');
  const last = setGames[setGames.length - 1];
  return last?.type === 'set_game' ? last.payload.tree : null;
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
 * The presenter's most recent cursor, restricted to ops after the current
 * game and only from the presenter — cursor ops from other members or from a
 * previous game are ignored.
 */
export function selectPresenterCursor(state: RoomState): number | null {
  const last = lastSetGame(state.ops);
  if (last === null) {
    return null;
  }
  let cursor: number | null = null;
  for (const op of state.ops) {
    if (op.seq <= last.seq) {
      continue;
    }
    if (op.type === 'set_cursor' && op.author === last.author) {
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
      state.game = null;
    },
    leaveRoom(state) {
      state.slug = null;
      state.ops = [];
      state.presence = {};
      state.game = null;
    },
    applyOp(state, action: PayloadAction<Op>) {
      const op = action.payload;
      const lastSeq = state.ops.length > 0 ? state.ops[state.ops.length - 1].seq : -1;
      if (op.seq > lastSeq) {
        state.ops.push(op);
        if (op.type === 'set_game') {
          state.game = op.payload.tree;
        }
      }
    },
    replayOps(state, action: PayloadAction<Op[]>) {
      state.ops = [...action.payload].sort((a, b) => a.seq - b.seq);
      state.game = gameFromOps(state.ops);
    },
    joinMember(state, action: PayloadAction<PresenceMember>) {
      state.presence[action.payload.id] = action.payload;
    },
    leaveMember(state, action: PayloadAction<{ id: string }>) {
      delete state.presence[action.payload.id];
    },
  },
});

export const { enterRoom, leaveRoom, applyOp, replayOps, joinMember, leaveMember } =
  roomSlice.actions;

export default roomSlice.reducer;
