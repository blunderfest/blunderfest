import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GameNode, GameTree } from '@/lib/api';
import type {
  CommentAtPlyOp,
  MemberRole,
  MoveAtPlyOp,
  Op,
  PresenceMember,
  SetGameOp,
} from '@/protocol/ops';

/**
 * `game_id` for `set_game` ops from before games had ids.
 */
export const LEGACY_GAME_ID = 'main';

export type RoomState = {
  slug: string | null;
  ops: Op[];
  presence: Record<string, PresenceMember>;
  roles: Record<string, MemberRole>;
  games: Record<string, GameTree>;
};

const initialState: RoomState = {
  slug: null,
  ops: [],
  presence: {},
  roles: {},
  games: {},
};

/**
 * The mainline node at the given ply (the root is ply 0), or null when the
 * mainline is shorter than the ply.
 */
function mainlineNode(tree: GameTree, ply: number): GameNode | null {
  let node = tree.root;
  while (node.ply !== ply) {
    const next = node.children[0];
    if (next === undefined) {
      return null;
    }
    node = next;
  }
  return node;
}

function maxNodeId(node: GameNode): number {
  let max = node.id;
  for (const child of node.children) {
    max = Math.max(max, maxNodeId(child));
  }
  return max;
}

function replaceNode(root: GameNode, id: number, update: (node: GameNode) => GameNode): GameNode {
  if (root.id === id) {
    return update(root);
  }
  return { ...root, children: root.children.map((child) => replaceNode(child, id, update)) };
}

function resultFor(status: string, ply: number): string | null {
  if (status === 'checkmate') {
    return ply % 2 === 1 ? '1-0' : '0-1';
  }
  if (status === 'stalemate' || status === 'draw') {
    return '1/2-1/2';
  }
  return null;
}

/**
 * Appends a move at the given ply to the tree. A move beyond the end of the
 * mainline extends it; a move into a position that already has children is
 * inserted as a variation. Node ids are derived deterministically (max + 1)
 * so every client replays to the same tree.
 */
export function applyMoveAtPly(tree: GameTree, payload: MoveAtPlyOp['payload']): GameTree {
  const parent = mainlineNode(tree, payload.ply - 1);
  if (parent === null) {
    return tree;
  }

  const node: GameNode = {
    id: maxNodeId(tree.root) + 1,
    ply: payload.ply,
    san: payload.san,
    from: payload.from,
    to: payload.to,
    promotion: payload.promotion,
    comment: null,
    nags: [],
    status: payload.status,
    fen: payload.fen,
    children: [],
  };

  const root = replaceNode(tree.root, parent.id, (parent) => ({
    ...parent,
    children: [...parent.children, node],
  }));

  return {
    ...tree,
    root,
    result: resultFor(payload.status, payload.ply) ?? tree.result,
    mainline_ply_count: Math.max(tree.mainline_ply_count, payload.ply),
    node_count: tree.node_count + 1,
  };
}

/**
 * Sets (or clears, with empty text) the comment on the mainline node at the
 * given ply. Comments on variation nodes are out of scope for now.
 */
export function applyCommentAtPly(tree: GameTree, payload: CommentAtPlyOp['payload']): GameTree {
  const node = mainlineNode(tree, payload.ply);
  if (node === null) {
    return tree;
  }
  const root = replaceNode(tree.root, node.id, (n) => ({
    ...n,
    comment: payload.text === '' ? null : payload.text,
  }));
  return { ...tree, root };
}

function applyOpToGame(state: RoomState, op: MoveAtPlyOp | CommentAtPlyOp): void {
  const tree = state.games[op.payload.game_id];
  if (tree === undefined) {
    return;
  }
  if (op.type === 'move_at_ply') {
    state.games[op.payload.game_id] = applyMoveAtPly(tree, op.payload);
  } else {
    state.games[op.payload.game_id] = applyCommentAtPly(tree, op.payload);
  }
}

export function gameIdOf(op: SetGameOp): string {
  return op.payload.game_id ?? LEGACY_GAME_ID;
}

/**
 * The first game imported into the room (lowest-seg `set_game` op) — the
 * default selection for a member who has not chosen a game themselves.
 */
export function selectFirstGameId(state: RoomState): string | null {
  for (const op of state.ops) {
    if (op.type === 'set_game') {
      return gameIdOf(op);
    }
  }
  return null;
}

/**
 * Room members sorted for the member list: owner, then collaborators, then
 * viewers, each group alphabetically by name. Members without a role are
 * treated as viewers.
 */
export const selectSortedMembers = createSelector(
  [(state: RoomState) => state.presence, (state: RoomState) => state.roles],
  (presence, roles) => {
    const roleRank = (role: MemberRole) => (role === 'owner' ? 0 : role === 'collaborator' ? 1 : 2);
    return Object.values(presence).sort((a, b) => {
      const rankA = roleRank(roles[a.id] ?? 'viewer');
      const rankB = roleRank(roles[b.id] ?? 'viewer');
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.name.localeCompare(b.name);
    });
  },
);

/**
 * Ops worth showing in the activity feed — cursor and selection noise
 * filtered out.
 */
export const selectActivityOps = createSelector([(state: RoomState) => state.ops], (ops) =>
  ops.filter((op) => op.type !== 'set_cursor' && op.type !== 'select_game'),
);

/**
 * The room role of `profileId` (everyone without an explicit role is a
 * viewer, including anonymous members).
 */
export function selectRoleOf(state: RoomState, profileId: string | null): MemberRole {
  if (profileId === null) {
    return 'viewer';
  }
  return state.roles[profileId] ?? 'viewer';
}

/**
 * Whether `profileId` may push edit ops (moves, imports, comments, arrows).
 */
export function selectCanEdit(state: RoomState, profileId: string | null): boolean {
  const role = selectRoleOf(state, profileId);
  return role === 'owner' || role === 'collaborator';
}

/**
 * The presenter is the room's owner — the member holding the `owner` role,
 * as long as they are still in the room. Nobody presents until an owner is
 * present.
 */
export function selectPresenter(state: RoomState): PresenceMember | null {
  let ownerId: string | null = null;
  for (const [id, role] of Object.entries(state.roles)) {
    if (role === 'owner') {
      ownerId = id;
      break;
    }
  }
  if (ownerId === null) {
    return null;
  }
  return state.presence[ownerId] ?? null;
}

/**
 * The game the presenter is currently viewing — the target of their last
 * focus op (their own import, or a `select_game` announcing a switch). Falls
 * back to the newest imported game when the owner has not focused anything.
 */
export function selectPresenterGameId(state: RoomState): string | null {
  const presenter = selectPresenter(state);
  if (presenter === null) {
    return null;
  }
  let focus: string | null = null;
  let newest: string | null = null;
  for (const op of state.ops) {
    if (op.type === 'set_game') {
      newest = gameIdOf(op);
      if (op.author === presenter.id) {
        focus = gameIdOf(op);
      }
    }
    if (op.type === 'select_game' && op.author === presenter.id) {
      focus = op.payload.game_id;
    }
  }
  return focus ?? newest;
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
      state.roles = {};
      state.games = {};
    },
    leaveRoom(state) {
      state.slug = null;
      state.ops = [];
      state.presence = {};
      state.roles = {};
      state.games = {};
    },
    setRoles(state, action: PayloadAction<Record<string, MemberRole>>) {
      state.roles = action.payload;
    },
    setMemberRole(state, action: PayloadAction<{ member_id: string; role: MemberRole }>) {
      state.roles[action.payload.member_id] = action.payload.role;
    },
    applyOp(state, action: PayloadAction<Op>) {
      const op = action.payload;
      const lastSeq = state.ops.length > 0 ? state.ops[state.ops.length - 1].seq : -1;
      if (op.seq > lastSeq) {
        state.ops.push(op);
        if (op.type === 'set_game') {
          state.games[gameIdOf(op)] = op.payload.tree;
        }
        if (op.type === 'move_at_ply' || op.type === 'comment_at_ply') {
          applyOpToGame(state, op);
        }
      }
    },
    replayOps(state, action: PayloadAction<Op[]>) {
      state.ops = [...action.payload].sort((a, b) => a.seq - b.seq);
      state.games = {};
      for (const op of state.ops) {
        if (op.type === 'set_game') {
          state.games[gameIdOf(op)] = op.payload.tree;
        }
      }
      for (const op of state.ops) {
        if (op.type === 'move_at_ply' || op.type === 'comment_at_ply') {
          applyOpToGame(state, op);
        }
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

export const {
  enterRoom,
  leaveRoom,
  setRoles,
  setMemberRole,
  applyOp,
  replayOps,
  joinMember,
  leaveMember,
} = roomSlice.actions;

export default roomSlice.reducer;
