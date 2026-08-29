import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GameNode, GameTree } from '@/lib/api';
import type {
  AddLineOp,
  AnalysisEval,
  CommentAtPlyOp,
  DrawnArrow,
  DrawnHighlight,
  MemberRole,
  MoveAtPlyOp,
  Op,
  PresenceMember,
  SetNagsOp,
  SetPositionOp,
} from '@/protocol/ops';

export type BoardAnnotations = { arrows: DrawnArrow[]; highlights: DrawnHighlight[] };

export type RoomState = {
  slug: string | null;
  ops: Op[];
  presence: Record<string, PresenceMember>;
  /**
   * Display names of everyone seen this room session, including members who
   * have since left — so historical entries (the activity feed) don't decay
   * to raw profile ids when someone departs.
   */
  names: Record<string, string>;
  roles: Record<string, MemberRole>;
  games: Record<string, GameTree>;
  /** Board drawings per game and node (gameId → nodeId → arrows+highlights). */
  annotations: Record<string, Record<number, BoardAnnotations>>;
  /**
   * The node created by the most recent move/setup op per game — the "move
   * last played", wherever it lives in the tree (variations included).
   * Drives the initial cursor on join/refresh.
   */
  lastPlayed: Record<string, number>;
  /**
   * Who authored the most recent move/setup op per game. `useCursor`'s
   * follow-the-tail only reacts to *other* members' plays — your own
   * variation inserts (setup + line ops) must never yank the cursor off
   * the position being analyzed.
   */
  lastPlayedBy: Record<string, string>;
  /** The Fly region of the machine this client is connected to (join reply). */
  region: string | null;
  /** The Fly region hosting the room process (join reply; null pre-join). */
  roomRegion: string | null;
  /** Latest measured channel round-trip in milliseconds (10s ping probe). */
  lagMs: number | null;
  /** The member the mic was handed to; null means the owner presents (ADR-0021). */
  presenterId: string | null;
  /**
   * Read-only rooms (the demo, ADR-0014): no presence, no roles, and the
   * server rejects every op — clients don't even send cursor updates.
   */
  readOnly: boolean;
  /** Whole-game engine analysis per game (ADR-0009), from `set_analysis` ops. */
  analysis: Record<string, { depth: number; evals: AnalysisEval[] }>;
  /** Room chat, newest last, capped (chat rides the op log — replay is the sync). */
  chatMessages: {
    seq: number;
    author: string;
    /**
     * The display-name snapshot from the durable mirror (ADR-0028) —
     * replayed chat resolves names even before presence refills.
     */
    author_name?: string;
    text: string;
    ts: string;
  }[];
  /** Live progress of a running analysis job (transient broadcast). */
  analysisProgress: { gameId: string; done: number; total: number } | null;
};

const initialState: RoomState = {
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
  roomRegion: null,
  lagMs: null,
  presenterId: null,
  readOnly: false,
  analysis: {},
  analysisProgress: null,
  chatMessages: [],
};

/** Chat history cap per room session (newest kept). */
const MAX_CHAT_MESSAGES = 200;

/** The merge key for an eval: its node id when known, else its ply (legacy mainline logs). */
function analysisKey(evaluation: AnalysisEval): string {
  return evaluation.node_id !== undefined ? `n:${evaluation.node_id}` : `p:${evaluation.ply}`;
}

/**
 * Merges a `set_analysis` op into the game's evals: entries override per
 * node (a re-run replaces its positions) while other nodes keep theirs (a
 * variation-line analysis doesn't clobber the mainline's). Insertion order
 * is preserved, so mainline entries stay in ply order for the chart.
 */
function mergeAnalysis(
  existing: { depth: number; evals: AnalysisEval[] } | undefined,
  incoming: AnalysisEval[],
  depth: number,
): { depth: number; evals: AnalysisEval[] } {
  const merged = new Map<string, AnalysisEval>();
  for (const evaluation of existing?.evals ?? []) {
    merged.set(analysisKey(evaluation), evaluation);
  }
  for (const evaluation of incoming) {
    merged.set(analysisKey(evaluation), evaluation);
  }
  return { depth, evals: [...merged.values()] };
}

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

/** The last node of the mainline (deepest first-child chain). */
function mainlineTip(tree: GameTree): GameNode {
  let node = tree.root;
  while (node.children[0] !== undefined) {
    node = node.children[0];
  }
  return node;
}

function findNode(node: GameNode, id: number): GameNode | null {
  if (node.id === id) {
    return node;
  }
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found !== null) {
      return found;
    }
  }
  return null;
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
 * Appends a move to the tree. The parent is the node named by
 * `payload.parent_id` (the cursor the move was played from — variation
 * parents included); ops from before variations were playable fall back to
 * the mainline node at `ply - 1`. Extending the mainline tip grows the
 * mainline; anything else inserts a variation. Node ids are derived
 * deterministically (max + 1) so every client replays to the same tree.
 * Game result and mainline ply count only change on mainline moves — a mate
 * in a variation is not the game's result.
 */
export function applyMoveAtPly(tree: GameTree, payload: MoveAtPlyOp['payload']): GameTree {
  const parent =
    payload.parent_id !== undefined
      ? findNode(tree.root, payload.parent_id)
      : mainlineNode(tree, payload.ply - 1);
  if (parent === null) {
    return tree;
  }
  const extendsMainline = parent.id === mainlineTip(tree).id;

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
    result: extendsMainline ? (resultFor(payload.status, payload.ply) ?? tree.result) : tree.result,
    mainline_ply_count: extendsMainline
      ? Math.max(tree.mainline_ply_count, payload.ply)
      : tree.mainline_ply_count,
    node_count: tree.node_count + 1,
  };
}

/**
 * Sets (or clears, with empty text) a comment. The target is the node named
 * by `payload.node_id` — variation and setup nodes included; ops from before
 * variation comments fall back to the mainline node at the given ply.
 */
export function applyCommentAtPly(tree: GameTree, payload: CommentAtPlyOp['payload']): GameTree {
  const node =
    payload.node_id !== undefined
      ? findNode(tree.root, payload.node_id)
      : mainlineNode(tree, payload.ply);
  if (node === null) {
    return tree;
  }
  const root = replaceNode(tree.root, node.id, (n) => ({
    ...n,
    comment: payload.text === '' ? null : payload.text,
  }));
  return { ...tree, root };
}

/**
 * The ply of a setup node from its FEN: the halfmove *before* the side to
 * move plays next, so descendants number correctly (white to move at move
 * N → 2N-2; black to move → 2N-1). Null for malformed FENs.
 */
export function setupPlyFromFen(fen: string): number | null {
  const parts = fen.split(' ');
  const fullmove = Number.parseInt(parts[5] ?? '', 10);
  if (Number.isNaN(fullmove) || fullmove < 1) {
    return null;
  }
  return parts[1] === 'b' ? fullmove * 2 - 1 : fullmove * 2 - 2;
}

/**
 * Appends a free-form position edit (ADR-0011) as a setup node under the
 * parent named by `parent_id`. Setup nodes never change the game result or
 * the mainline ply count.
 */
export function applySetPosition(tree: GameTree, payload: SetPositionOp['payload']): GameTree {
  const parent = findNode(tree.root, payload.parent_id);
  if (parent === null) {
    return tree;
  }

  const node: GameNode = {
    id: maxNodeId(tree.root) + 1,
    ply: setupPlyFromFen(payload.fen) ?? parent.ply + 1,
    san: null,
    from: null,
    to: null,
    promotion: null,
    comment: null,
    nags: [],
    status: 'active',
    fen: payload.fen,
    children: [],
  };

  const root = replaceNode(tree.root, parent.id, (parent) => ({
    ...parent,
    children: [...parent.children, node],
  }));

  return { ...tree, root, node_count: tree.node_count + 1 };
}

/**
 * Inserts a whole line under a node (ADR-0005 echo path, e.g. an engine
 * line as a variation). Moves that already exist as a child of the current
 * node (same from/to/promotion) are descended into instead of duplicated;
 * new nodes take the deterministic max+1 ids, so every client replays to
 * the same tree. Only extending the mainline tip moves the game's result
 * and ply count.
 */
export function applyAddLine(tree: GameTree, payload: AddLineOp['payload']): GameTree {
  if (payload.moves.length === 0 || findNode(tree.root, payload.parent_id) === null) {
    return tree;
  }

  let root = tree.root;
  let nextId = maxNodeId(root) + 1;
  let cursorId = payload.parent_id;
  let result = tree.result;
  let mainlinePlyCount = tree.mainline_ply_count;
  let added = 0;

  for (const move of payload.moves) {
    const cursor = findNode(root, cursorId);
    if (cursor === null) {
      return { ...tree, root, result, mainline_ply_count: mainlinePlyCount };
    }
    const existing = cursor.children.find(
      (child) =>
        child.from === move.from && child.to === move.to && child.promotion === move.promotion,
    );
    if (existing !== undefined) {
      cursorId = existing.id;
      continue;
    }
    let tip = root;
    while (tip.children[0] !== undefined) {
      tip = tip.children[0];
    }
    const extendsMainline = cursor.id === tip.id;
    const ply = cursor.ply + 1;
    const node: GameNode = {
      id: nextId,
      ply,
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      comment: null,
      nags: [],
      status: move.status,
      fen: move.fen,
      children: [],
    };
    nextId += 1;
    added += 1;
    root = replaceNode(root, cursorId, (current) => ({
      ...current,
      children: [...current.children, node],
    }));
    if (extendsMainline) {
      result = resultFor(move.status, ply) ?? result;
      mainlinePlyCount = Math.max(mainlinePlyCount, ply);
    }
    cursorId = node.id;
  }

  return {
    ...tree,
    root,
    result,
    mainline_ply_count: mainlinePlyCount,
    node_count: tree.node_count + added,
  };
}

/** Sets (or clears, with an empty list) a node's NAGs — full replace. */
export function applySetNags(tree: GameTree, payload: SetNagsOp['payload']): GameTree {
  if (findNode(tree.root, payload.node_id) === null) {
    return tree;
  }
  return {
    ...tree,
    root: replaceNode(tree.root, payload.node_id, (node) => ({ ...node, nags: payload.nags })),
  };
}

function applyOpToGame(
  state: RoomState,
  op: MoveAtPlyOp | CommentAtPlyOp | SetPositionOp | AddLineOp | SetNagsOp,
): void {
  const tree = state.games[op.payload.game_id];
  if (tree === undefined) {
    return;
  }
  if (op.type === 'move_at_ply') {
    state.games[op.payload.game_id] = applyMoveAtPly(tree, op.payload);
  } else if (op.type === 'comment_at_ply') {
    state.games[op.payload.game_id] = applyCommentAtPly(tree, op.payload);
  } else if (op.type === 'add_line') {
    state.games[op.payload.game_id] = applyAddLine(tree, op.payload);
  } else if (op.type === 'set_nags') {
    state.games[op.payload.game_id] = applySetNags(tree, op.payload);
  } else {
    state.games[op.payload.game_id] = applySetPosition(tree, op.payload);
  }
}

/**
 * Drops a game and every per-game slice keyed by it (annotations, analysis,
 * last-played). The op log keeps the full history (append-only, ADR-0005) —
 * the game is simply no longer materialized, and selectors that scan the log
 * (selection, presenter focus, evidence gids) skip it because its `set_game`
 * was never applied. Any later re-import works on a fresh tree.
 */
function removeGame(state: RoomState, gameId: string): void {
  delete state.games[gameId];
  delete state.annotations[gameId];
  delete state.analysis[gameId];
  delete state.lastPlayed[gameId];
  delete state.lastPlayedBy[gameId];
  if (state.analysisProgress?.gameId === gameId) {
    state.analysisProgress = null;
  }
}

/**
 * The first game present in the room (lowest-seq `set_game` whose game was
 * not removed) — the default selection for a member who has not chosen a
 * game themselves. The log is append-only, so removal (`remove_game`) is
 * detected by the game being absent from the materialized games map.
 */
export function selectFirstGameId(state: RoomState): string | null {
  for (const op of state.ops) {
    if (op.type === 'set_game' && state.games[op.payload.game_id] !== undefined) {
      return op.payload.game_id;
    }
  }
  return null;
}

/**
 * The node created by the most recent move/setup op in `gameId` — the "move
 * last played", wherever it lives in the tree. Null when nothing has been
 * played yet (an untouched import), where callers fall back to the mainline
 * tip.
 */
export function selectLastPlayed(state: RoomState, gameId: string | null): number | null {
  if (gameId === null) {
    return null;
  }
  return state.lastPlayed[gameId] ?? null;
}

/**
 * Corpus game ids that entered the room via the Examples dialog — derived
 * from the op log (`evidence_gid` on `set_game`), so every client agrees
 * on which candidates are already in the room. Memoized on the op log.
 */
export const selectEvidenceGids = createSelector([(state: RoomState) => state.ops], (ops) => {
  const gids = new Set<number>();
  for (const op of ops) {
    if (op.type === 'set_game' && op.payload.evidence_gid !== undefined) {
      gids.add(op.payload.evidence_gid);
    }
  }
  return gids;
});

/**
 * Who authored the most recent move/setup op in `gameId` — follow-the-tail
 * only reacts to other members' plays, so the caller compares this against
 * the viewer's own profile id.
 */
export function selectLastPlayedBy(state: RoomState, gameId: string | null): string | null {
  if (gameId === null) {
    return null;
  }
  return state.lastPlayedBy[gameId] ?? null;
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
 * The presenter: the member the mic was handed to (`presenterId`), as long
 * as they are in the room; otherwise the owner, as long as they are in the
 * room. Presenting derives from presence, so an absent presenter yields the
 * floor back to the owner automatically (ADR-0021).
 */
export const selectPresenter = createSelector(
  [
    (state: RoomState) => state.roles,
    (state: RoomState) => state.presence,
    (state: RoomState) => state.presenterId,
  ],
  (roles, presence, presenterId) => {
    if (presenterId !== null && presence[presenterId] !== undefined) {
      return presence[presenterId];
    }
    let ownerId: string | null = null;
    for (const [id, role] of Object.entries(roles)) {
      if (role === 'owner') {
        ownerId = id;
        break;
      }
    }
    if (ownerId === null) {
      return null;
    }
    return presence[ownerId] ?? null;
  },
);

/**
 * The game the presenter is currently viewing — the target of their last
 * focus op (their own import, or a `select_game` announcing a switch). Falls
 * back to the newest imported game when the owner has not focused anything.
 * Memoized: it scans the op log, which would otherwise re-run on every
 * dispatch (cursor ops make dispatches frequent).
 */
export const selectPresenterGameId = createSelector(
  [(state: RoomState) => state.ops, (state: RoomState) => state.games, selectPresenter],
  (ops, games, presenter) => {
    if (presenter === null) {
      return null;
    }
    let focus: string | null = null;
    let newest: string | null = null;
    for (const op of ops) {
      if (op.type === 'set_game' && games[op.payload.game_id] !== undefined) {
        newest = op.payload.game_id;
        if (op.author === presenter.id) {
          focus = op.payload.game_id;
        }
      }
      if (
        op.type === 'select_game' &&
        op.author === presenter.id &&
        games[op.payload.game_id] !== undefined
      ) {
        focus = op.payload.game_id;
      }
    }
    return focus ?? newest;
  },
);

/**
 * The presenter's most recent cursor, restricted to ops after the game they
 * are currently viewing — cursor ops from other members, or from a previous
 * game, are ignored. Memoized for the same reason as selectPresenterGameId.
 */
export const selectPresenterCursor = createSelector(
  [(state: RoomState) => state.ops, selectPresenter],
  (ops, presenter) => {
    if (presenter === null) {
      return null;
    }
    let focusSeq = -1;
    for (const op of ops) {
      if (op.author !== presenter.id) {
        continue;
      }
      if (op.type === 'set_game' || op.type === 'select_game') {
        focusSeq = op.seq;
      }
    }
    let cursor: number | null = null;
    for (const op of ops) {
      if (op.seq <= focusSeq) {
        continue;
      }
      if (op.type === 'set_cursor' && op.author === presenter.id) {
        cursor = op.payload.node_id;
      }
    }
    return cursor;
  },
);

const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    enterRoom(state, action: PayloadAction<{ slug: string }>) {
      state.slug = action.payload.slug;
      state.ops = [];
      state.presence = {};
      state.names = {};
      state.roles = {};
      state.games = {};
      state.lastPlayed = {};
      state.lastPlayedBy = {};
      state.annotations = {};
      state.region = null;
      state.roomRegion = null;
      state.lagMs = null;
      state.presenterId = null;
      state.readOnly = false;
      state.analysis = {};
      state.analysisProgress = null;
    },
    leaveRoom(state) {
      state.slug = null;
      state.ops = [];
      state.presence = {};
      state.names = {};
      state.roles = {};
      state.games = {};
      state.lastPlayed = {};
      state.lastPlayedBy = {};
      state.annotations = {};
      state.region = null;
      state.roomRegion = null;
      state.lagMs = null;
      state.presenterId = null;
      state.readOnly = false;
      state.analysis = {};
      state.analysisProgress = null;
    },
    setRoles(state, action: PayloadAction<Record<string, MemberRole>>) {
      state.roles = action.payload;
    },
    setReadOnly(state, action: PayloadAction<boolean>) {
      state.readOnly = action.payload;
    },
    setAnalysisProgress(
      state,
      action: PayloadAction<{ gameId: string; done: number; total: number } | null>,
    ) {
      state.analysisProgress = action.payload;
    },
    setRegion(state, action: PayloadAction<string | null>) {
      state.region = action.payload;
    },
    setRoomRegion(state, action: PayloadAction<string | null>) {
      state.roomRegion = action.payload;
    },
    setPresenter(state, action: PayloadAction<string | null>) {
      state.presenterId = action.payload;
    },
    setLag(state, action: PayloadAction<{ ms: number | null }>) {
      state.lagMs = action.payload.ms;
    },
    setMemberRole(state, action: PayloadAction<{ member_id: string; role: MemberRole }>) {
      state.roles[action.payload.member_id] = action.payload.role;
    },
    applyOp(state, action: PayloadAction<Op>) {
      const op = action.payload;
      const lastSeq = state.ops.length > 0 ? state.ops[state.ops.length - 1].seq : -1;
      if (op.seq > lastSeq) {
        state.ops.push(op);
        if (op.type === 'chat') {
          state.chatMessages.push({
            seq: op.seq,
            author: op.author,
            author_name: op.author_name,
            text: op.payload.text,
            ts: op.ts,
          });
          if (state.chatMessages.length > MAX_CHAT_MESSAGES) {
            state.chatMessages.splice(0, state.chatMessages.length - MAX_CHAT_MESSAGES);
          }
        }
        if (op.type === 'delete_chat') {
          // Owner moderation (ADR-0023): the chat op stays in the log; the
          // message is filtered out of the visible list.
          state.chatMessages = state.chatMessages.filter(
            (message) => message.seq !== op.payload.seq,
          );
        }
        if (op.type === 'set_analysis') {
          state.analysis[op.payload.game_id] = mergeAnalysis(
            state.analysis[op.payload.game_id],
            op.payload.evals,
            op.payload.depth,
          );
          if (state.analysisProgress?.gameId === op.payload.game_id) {
            state.analysisProgress = null;
          }
        }
        if (op.type === 'set_game') {
          state.games[op.payload.game_id] = op.payload.tree;
        }
        if (op.type === 'remove_game') {
          removeGame(state, op.payload.game_id);
        }
        if (op.type === 'set_annotations') {
          const byNode = state.annotations[op.payload.game_id] ?? {};
          state.annotations[op.payload.game_id] = byNode;
          byNode[op.payload.node_id] = {
            arrows: op.payload.arrows,
            highlights: op.payload.highlights,
          };
        }
        if (
          op.type === 'move_at_ply' ||
          op.type === 'comment_at_ply' ||
          op.type === 'set_position' ||
          op.type === 'add_line' ||
          op.type === 'set_nags'
        ) {
          applyOpToGame(state, op);
          if (op.type === 'move_at_ply' || op.type === 'set_position' || op.type === 'add_line') {
            const tree = state.games[op.payload.game_id];
            if (tree !== undefined) {
              // Post-apply max is the newest node — for a line, its end.
              state.lastPlayed[op.payload.game_id] = maxNodeId(tree.root);
              state.lastPlayedBy[op.payload.game_id] = op.author;
            }
          }
        }
      }
    },
    replayOps(state, action: PayloadAction<Op[]>) {
      state.ops = [...action.payload].sort((a, b) => a.seq - b.seq);
      state.games = {};
      state.lastPlayed = {};
      state.lastPlayedBy = {};
      state.annotations = {};
      state.analysis = {};
      state.analysisProgress = null;
      // Deleted chat (ADR-0023) stays in the log but is filtered from view.
      const deletedChat = new Set(
        state.ops
          .filter((op): op is Extract<Op, { type: 'delete_chat' }> => op.type === 'delete_chat')
          .map((op) => op.payload.seq),
      );
      state.chatMessages = state.ops
        .filter((op): op is Extract<Op, { type: 'chat' }> => op.type === 'chat')
        .filter((op) => !deletedChat.has(op.seq))
        .slice(-MAX_CHAT_MESSAGES)
        .map((op) => ({
          seq: op.seq,
          author: op.author,
          author_name: op.author_name,
          text: op.payload.text,
          ts: op.ts,
        }));
      for (const op of state.ops) {
        if (op.type === 'set_analysis') {
          state.analysis[op.payload.game_id] = mergeAnalysis(
            state.analysis[op.payload.game_id],
            op.payload.evals,
            op.payload.depth,
          );
        }
        if (op.type === 'set_game') {
          state.games[op.payload.game_id] = op.payload.tree;
        }
        if (op.type === 'remove_game') {
          // The game is filtered from view on replay (ADR-0023 pattern):
          // its set_game/moves are skipped in the loop below because the
          // tree is gone, so it never materializes.
          removeGame(state, op.payload.game_id);
        }
        if (op.type === 'set_annotations') {
          if (state.games[op.payload.game_id] !== undefined) {
            const byNode = state.annotations[op.payload.game_id] ?? {};
            state.annotations[op.payload.game_id] = byNode;
            byNode[op.payload.node_id] = {
              arrows: op.payload.arrows,
              highlights: op.payload.highlights,
            };
          }
        }
      }
      for (const op of state.ops) {
        if (
          op.type === 'move_at_ply' ||
          op.type === 'comment_at_ply' ||
          op.type === 'set_position' ||
          op.type === 'add_line' ||
          op.type === 'set_nags'
        ) {
          applyOpToGame(state, op);
          if (op.type === 'move_at_ply' || op.type === 'set_position' || op.type === 'add_line') {
            const tree = state.games[op.payload.game_id];
            if (tree !== undefined) {
              // Post-apply max is the newest node — for a line, its end.
              state.lastPlayed[op.payload.game_id] = maxNodeId(tree.root);
              state.lastPlayedBy[op.payload.game_id] = op.author;
            }
          }
        }
      }
    },
    /**
     * Replaces the member list from the presence layer's authoritative
     * state. The phoenix Presence helper tracks metas per key (one profile
     * can hold several tabs), so a diff's "leave" of one tab must not drop
     * the member — only a full sync stays correct. Names persist for
     * members who left (chat history, durable snapshots).
     */
    syncMembers(state, action: PayloadAction<PresenceMember[]>) {
      state.presence = {};
      for (const member of action.payload) {
        state.presence[member.id] = member;
        state.names[member.id] = member.name;
      }
    },
  },
});

export const {
  enterRoom,
  leaveRoom,
  setRoles,
  setReadOnly,
  setRegion,
  setRoomRegion,
  setLag,
  setMemberRole,
  setPresenter,
  setAnalysisProgress,
  applyOp,
  replayOps,
  syncMembers,
} = roomSlice.actions;

export default roomSlice.reducer;
