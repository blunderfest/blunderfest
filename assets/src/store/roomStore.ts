/**
 * The room store: the whole room state as a single `@xstate/store`.
 *
 * The room is an event-sourced projection over the server's op log
 * (ADR-0005), and the store is built to match: the `Op` union is the store's
 * event type, so ops are sent directly (`store.send(op)`) instead of being
 * wrapped in adapter actions. Join-time replay folds the log through the same
 * `store.transition` used live, so replay and live application share one code
 * path. Ephemeral UI state (presence, roles, regions, lag, presenter) lives in
 * the same context, so every read observes one coherent snapshot.
 *
 * A fresh store is created per room (`createRoomStore`) and injected, so tests
 * and concurrent rooms never share state. Components read via `useRoomSelector`
 * and never dispatch — the channel (`useRoomChannel`) is the only writer.
 */
import { createStore } from '@xstate/store';
import type { GameNode, GameTree } from '@/lib/api';
import type {
  AddLineOp,
  AnalysisEval,
  ChatOp,
  CommentAtPlyOp,
  DeleteChatOp,
  DrawnArrow,
  DrawnHighlight,
  MemberRole,
  MoveAtPlyOp,
  Op,
  PresenceMember,
  SetAnalysisOp,
  SetAnnotationsOp,
  SetGameOp,
  SetNagsOp,
  SetPositionOp,
} from '@/protocol/ops';

/** Chat history cap per room session (newest kept). */
const MAX_CHAT_MESSAGES = 200;

export type BoardAnnotations = { arrows: DrawnArrow[]; highlights: DrawnHighlight[] };

type ChatMessage = {
  seq: number;
  author: string;
  author_name?: string;
  text: string;
  ts: string;
};

/** The whole room state: the op-log projection plus ephemeral UI state. */
export type RoomContext = {
  slug: string | null;
  ops: Op[];
  presence: Record<string, PresenceMember>;
  /** Display names of everyone seen this session, including members who left. */
  names: Record<string, string>;
  roles: Record<string, MemberRole>;
  games: Record<string, GameTree>;
  annotations: Record<string, Record<number, BoardAnnotations>>;
  lastPlayed: Record<string, number>;
  lastPlayedBy: Record<string, string>;
  region: string | null;
  roomRegion: string | null;
  lagMs: number | null;
  presenterId: string | null;
  readOnly: boolean;
  analysis: Record<string, { depth: number; evals: AnalysisEval[] }>;
  analysisProgress: { gameId: string; done: number; total: number } | null;
  chatMessages: ChatMessage[];
};

export function initialRoomContext(slug: string | null = null): RoomContext {
  return {
    slug,
    ops: [],
    presence: {},
    names: {},
    roles: {},
    games: {},
    annotations: {},
    lastPlayed: {},
    lastPlayedBy: {},
    region: null,
    roomRegion: null,
    lagMs: null,
    presenterId: null,
    readOnly: false,
    analysis: {},
    analysisProgress: null,
    chatMessages: [],
  };
}

// --- Pure fold helpers (the op → state transitions) ---

function analysisKey(evaluation: AnalysisEval): string {
  return evaluation.node_id !== undefined ? `n:${evaluation.node_id}` : `p:${evaluation.ply}`;
}

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

export function setupPlyFromFen(fen: string): number | null {
  const parts = fen.split(' ');
  const fullmove = Number.parseInt(parts[5] ?? '', 10);
  if (Number.isNaN(fullmove) || fullmove < 1) {
    return null;
  }
  return parts[1] === 'b' ? fullmove * 2 - 1 : fullmove * 2 - 2;
}

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

export function applySetNags(tree: GameTree, payload: SetNagsOp['payload']): GameTree {
  if (findNode(tree.root, payload.node_id) === null) {
    return tree;
  }
  return {
    ...tree,
    root: replaceNode(tree.root, payload.node_id, (node) => ({ ...node, nags: payload.nags })),
  };
}

function renameHelper(
  games: Record<string, GameTree>,
  gameId: string,
  title: string,
): Record<string, GameTree> {
  const tree = games[gameId];
  if (tree === undefined) {
    return games;
  }
  const headers = { ...tree.headers };
  if (title === '') {
    delete headers.Title;
  } else {
    headers.Title = title;
  }
  return { ...games, [gameId]: { ...tree, headers } };
}

function removeGame(ctx: RoomContext, gameId: string): RoomContext {
  const games = { ...ctx.games };
  const annotations = { ...ctx.annotations };
  const analysis = { ...ctx.analysis };
  const lastPlayed = { ...ctx.lastPlayed };
  const lastPlayedBy = { ...ctx.lastPlayedBy };
  delete games[gameId];
  delete annotations[gameId];
  delete analysis[gameId];
  delete lastPlayed[gameId];
  delete lastPlayedBy[gameId];
  return {
    ...ctx,
    games,
    annotations,
    analysis,
    lastPlayed,
    lastPlayedBy,
    analysisProgress: ctx.analysisProgress?.gameId === gameId ? null : ctx.analysisProgress,
  };
}

function applyToGame(
  ctx: RoomContext,
  gameId: string,
  update: (tree: GameTree) => GameTree,
): RoomContext {
  const tree = ctx.games[gameId];
  if (tree === undefined) {
    return ctx;
  }
  return { ...ctx, games: { ...ctx.games, [gameId]: update(tree) } };
}

/** Records the newest played node + its author for a play/setup/line op. */
function recordPlay(ctx: RoomContext, gameId: string, author: string): RoomContext {
  const tree = ctx.games[gameId];
  if (tree === undefined) {
    return ctx;
  }
  return {
    ...ctx,
    lastPlayed: { ...ctx.lastPlayed, [gameId]: maxNodeId(tree.root) },
    lastPlayedBy: { ...ctx.lastPlayedBy, [gameId]: author },
  };
}

// --- The fold: one op into the context (single pass; replay shares it) ---

function fold(ctx: RoomContext, op: Op): RoomContext {
  const lastSeq = ctx.ops.length > 0 ? ctx.ops[ctx.ops.length - 1].seq : -1;
  if (op.seq <= lastSeq) {
    return ctx;
  }
  let next: RoomContext = { ...ctx, ops: [...ctx.ops, op] };

  switch (op.type) {
    case 'chat': {
      const message: ChatMessage = {
        seq: op.seq,
        author: op.author,
        author_name: op.author_name,
        text: op.payload.text,
        ts: op.ts,
      };
      const chatMessages = [...next.chatMessages, message];
      next = {
        ...next,
        chatMessages:
          chatMessages.length > MAX_CHAT_MESSAGES
            ? chatMessages.slice(chatMessages.length - MAX_CHAT_MESSAGES)
            : chatMessages,
      };
      break;
    }
    case 'delete_chat':
      next = {
        ...next,
        chatMessages: next.chatMessages.filter((m) => m.seq !== op.payload.seq),
      };
      break;
    case 'set_analysis':
      next = {
        ...next,
        analysis: {
          ...next.analysis,
          [op.payload.game_id]: mergeAnalysis(
            next.analysis[op.payload.game_id],
            op.payload.evals,
            op.payload.depth,
          ),
        },
        analysisProgress:
          next.analysisProgress?.gameId === op.payload.game_id ? null : next.analysisProgress,
      };
      break;
    case 'set_game':
      next = { ...next, games: { ...next.games, [op.payload.game_id]: op.payload.tree } };
      break;
    case 'remove_game':
      next = removeGame(next, op.payload.game_id);
      break;
    case 'rename_game':
      // The title is a custom PGN header (like Event — not one of the
      // standard seven tags): exports carry it and the derivation helper
      // reads it first.
      next = {
        ...next,
        games: renameHelper(next.games, op.payload.game_id, op.payload.title),
      };
      break;
    case 'set_annotations':
      // Annotations for a removed game are a no-op (consistent live + replay).
      if (next.games[op.payload.game_id] !== undefined) {
        const byNode = next.annotations[op.payload.game_id] ?? {};
        next = {
          ...next,
          annotations: {
            ...next.annotations,
            [op.payload.game_id]: {
              ...byNode,
              [op.payload.node_id]: {
                arrows: op.payload.arrows,
                highlights: op.payload.highlights,
              },
            },
          },
        };
      }
      break;
    case 'move_at_ply':
      next = recordPlay(
        applyToGame(next, op.payload.game_id, (t) => applyMoveAtPly(t, op.payload)),
        op.payload.game_id,
        op.author,
      );
      break;
    case 'comment_at_ply':
      next = applyToGame(next, op.payload.game_id, (t) => applyCommentAtPly(t, op.payload));
      break;
    case 'add_line':
      next = recordPlay(
        applyToGame(next, op.payload.game_id, (t) => applyAddLine(t, op.payload)),
        op.payload.game_id,
        op.author,
      );
      break;
    case 'set_nags':
      next = applyToGame(next, op.payload.game_id, (t) => applySetNags(t, op.payload));
      break;
    case 'set_position':
      next = recordPlay(
        applyToGame(next, op.payload.game_id, (t) => applySetPosition(t, op.payload)),
        op.payload.game_id,
        op.author,
      );
      break;
    default:
      // select_game / set_cursor / replace_line carry no projection effects.
      break;
  }
  return next;
}

/** UI (non-op) events — the channel and components send these; they never cross the wire. */
export type RoomUiEvent =
  | { type: 'room.entered'; slug: string }
  | { type: 'room.left' }
  | { type: 'room.replayed'; ops: Op[] }
  | { type: 'roles.set'; roles: Record<string, MemberRole> }
  | { type: 'role.changed'; member_id: string; role: MemberRole }
  | { type: 'readOnly.set'; value: boolean }
  | { type: 'analysisProgress.set'; value: { gameId: string; done: number; total: number } | null }
  | { type: 'region.set'; value: string | null }
  | { type: 'roomRegion.set'; value: string | null }
  | { type: 'presenter.set'; value: string | null }
  | { type: 'lag.set'; ms: number | null }
  | { type: 'members.synced'; members: PresenceMember[] };

export type RoomStoreEvent = Op | RoomUiEvent;

export function createRoomStore(slug: string | null = null) {
  return createStore({
    context: initialRoomContext(slug) as RoomContext,
    on: {
      // Op events fold into the projection.
      set_game: (ctx, op: SetGameOp) => fold(ctx, op),
      remove_game: (ctx, op: Extract<Op, { type: 'remove_game' }>) => fold(ctx, op),
      rename_game: (ctx, op: Extract<Op, { type: 'rename_game' }>) => fold(ctx, op),
      select_game: (ctx, op: Extract<Op, { type: 'select_game' }>) => fold(ctx, op),
      move_at_ply: (ctx, op: MoveAtPlyOp) => fold(ctx, op),
      replace_line: (ctx, op: Extract<Op, { type: 'replace_line' }>) => fold(ctx, op),
      add_line: (ctx, op: AddLineOp) => fold(ctx, op),
      comment_at_ply: (ctx, op: CommentAtPlyOp) => fold(ctx, op),
      set_annotations: (ctx, op: SetAnnotationsOp) => fold(ctx, op),
      set_cursor: (ctx, op: Extract<Op, { type: 'set_cursor' }>) => fold(ctx, op),
      set_nags: (ctx, op: SetNagsOp) => fold(ctx, op),
      set_position: (ctx, op: SetPositionOp) => fold(ctx, op),
      set_analysis: (ctx, op: SetAnalysisOp) => fold(ctx, op),
      chat: (ctx, op: ChatOp) => fold(ctx, op),
      delete_chat: (ctx, op: DeleteChatOp) => fold(ctx, op),

      // UI events.
      'room.entered': (_ctx, e: { slug: string }) => initialRoomContext(e.slug),
      'room.left': () => initialRoomContext(null),
      'room.replayed': (ctx, e: { ops: Op[] }) => {
        // Join-time replay: fold the log through the same path as live apply,
        // from a clean projection (UI state is preserved across the replay).
        const clean: RoomContext = { ...ctx, ...initialRoomContext(ctx.slug), slug: ctx.slug };
        return e.ops
          .slice()
          .sort((a, b) => a.seq - b.seq)
          .reduce(fold, clean);
      },
      'roles.set': (ctx, e: { roles: Record<string, MemberRole> }) => ({ ...ctx, roles: e.roles }),
      'role.changed': (ctx, e: { member_id: string; role: MemberRole }) => ({
        ...ctx,
        roles: { ...ctx.roles, [e.member_id]: e.role },
      }),
      'readOnly.set': (ctx, e: { value: boolean }) => ({ ...ctx, readOnly: e.value }),
      'analysisProgress.set': (
        ctx,
        e: { value: { gameId: string; done: number; total: number } | null },
      ) => ({ ...ctx, analysisProgress: e.value }),
      'region.set': (ctx, e: { value: string | null }) => ({ ...ctx, region: e.value }),
      'roomRegion.set': (ctx, e: { value: string | null }) => ({ ...ctx, roomRegion: e.value }),
      'presenter.set': (ctx, e: { value: string | null }) => ({ ...ctx, presenterId: e.value }),
      'lag.set': (ctx, e: { ms: number | null }) => ({ ...ctx, lagMs: e.ms }),
      'members.synced': (ctx, e: { members: PresenceMember[] }) => {
        const presence: Record<string, PresenceMember> = {};
        const names = { ...ctx.names };
        for (const member of e.members) {
          presence[member.id] = member;
          names[member.id] = member.name;
        }
        return { ...ctx, presence, names };
      },
    },
  });
}

export type RoomStore = ReturnType<typeof createRoomStore>;

// --- Selectors (context in, derived value out) ---

/**
 * Memoizes a selector on its context's identity. Selectors that allocate a
 * fresh container each call (sort → array, collect → Set) must return a
 * stable reference: the store hook re-reads the selected value on every
 * notify and compares with `===`, so a fresh reference each read loops even
 * when nothing changed. The context is replaced immutably per event, so its
 * identity is a sound cache key.
 */
function memo<Args extends unknown[], R>(
  fn: (ctx: RoomContext, ...args: Args) => R,
): (ctx: RoomContext, ...args: Args) => R {
  let lastCtx: RoomContext | null = null;
  let lastResult: R | undefined;
  return (ctx: RoomContext, ...args: Args): R => {
    if (lastCtx === ctx) {
      return lastResult as R;
    }
    const result = fn(ctx, ...args);
    lastCtx = ctx;
    lastResult = result;
    return result;
  };
}

export function selectFirstGameId(ctx: RoomContext): string | null {
  for (const op of ctx.ops) {
    if (op.type === 'set_game' && ctx.games[op.payload.game_id] !== undefined) {
      return op.payload.game_id;
    }
  }
  return null;
}

/**
 * The room's games in deterministic `set_game` seq order, so the title
 * derivation ("Game N") counts the same on every client — `Object.entries`
 * order is not shared knowledge.
 */
export const selectGameEntries = memo((ctx: RoomContext): [string, GameTree][] => {
  const ordered: string[] = [];
  for (const op of ctx.ops) {
    if (op.type === 'set_game' && ctx.games[op.payload.game_id] !== undefined) {
      ordered.push(op.payload.game_id);
    }
  }
  return ordered.map((id) => [id, ctx.games[id]]);
});

/**
 * The next free default-number for a new game, from the WHOLE op log
 * (including removed games): the count is a monotonically increasing
 * room-scoped counter, so "Game 1 · Game 2 → remove Game 1 → + new game"
 * never reuses a number that existed before. Matches the exact i18n
 * label shape "Game N" only, so arbitrary renames or event headers can't
 * poison the counter; a user explicitly typing "Game 5" does bump it
 * (intentional — that's their chosen number).
 */
export function selectNextGameNumber(ctx: RoomContext, label: string): number {
  const pattern = new RegExp(`^${label.trim()}\\s+(\\d+)$`);
  let used = 0;
  for (const op of ctx.ops) {
    if (op.type === 'set_game') {
      const match = pattern.exec(op.payload.tree.headers.Title?.trim() ?? '');
      if (match !== null) {
        used = Math.max(used, Number.parseInt(match[1] ?? '0', 10));
      }
    }
  }
  return used + 1;
}

export function selectLastPlayed(ctx: RoomContext, gameId: string | null): number | null {
  if (gameId === null) {
    return null;
  }
  return ctx.lastPlayed[gameId] ?? null;
}

export const selectEvidenceGids = memo((ctx: RoomContext): Set<number> => {
  const gids = new Set<number>();
  for (const op of ctx.ops) {
    if (op.type === 'set_game' && op.payload.evidence_gid !== undefined) {
      gids.add(op.payload.evidence_gid);
    }
  }
  return gids;
});

export function selectLastPlayedBy(ctx: RoomContext, gameId: string | null): string | null {
  if (gameId === null) {
    return null;
  }
  return ctx.lastPlayedBy[gameId] ?? null;
}

export const selectSortedMembers = memo((ctx: RoomContext): PresenceMember[] => {
  const roleRank = (role: MemberRole) => (role === 'owner' ? 0 : role === 'collaborator' ? 1 : 2);
  return Object.values(ctx.presence).sort((a, b) => {
    const rankA = roleRank(ctx.roles[a.id] ?? 'viewer');
    const rankB = roleRank(ctx.roles[b.id] ?? 'viewer');
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.name.localeCompare(b.name);
  });
});

export function selectRoleOf(ctx: RoomContext, profileId: string | null): MemberRole {
  if (profileId === null) {
    return 'viewer';
  }
  return ctx.roles[profileId] ?? 'viewer';
}

export function selectCanEdit(ctx: RoomContext, profileId: string | null): boolean {
  const role = selectRoleOf(ctx, profileId);
  return role === 'owner' || role === 'collaborator';
}

export function selectPresenter(ctx: RoomContext): PresenceMember | null {
  if (ctx.presenterId !== null && ctx.presence[ctx.presenterId] !== undefined) {
    return ctx.presence[ctx.presenterId];
  }
  let ownerId: string | null = null;
  for (const [id, role] of Object.entries(ctx.roles)) {
    if (role === 'owner') {
      ownerId = id;
      break;
    }
  }
  if (ownerId === null) {
    return null;
  }
  return ctx.presence[ownerId] ?? null;
}

export function selectPresenterGameId(ctx: RoomContext): string | null {
  const presenter = selectPresenter(ctx);
  if (presenter === null) {
    return null;
  }
  let focus: string | null = null;
  let newest: string | null = null;
  for (const op of ctx.ops) {
    if (op.type === 'set_game' && ctx.games[op.payload.game_id] !== undefined) {
      newest = op.payload.game_id;
      if (op.author === presenter.id) {
        focus = op.payload.game_id;
      }
    }
    if (
      op.type === 'select_game' &&
      op.author === presenter.id &&
      ctx.games[op.payload.game_id] !== undefined
    ) {
      focus = op.payload.game_id;
    }
  }
  return focus ?? newest;
}

export function selectPresenterCursor(ctx: RoomContext): number | null {
  const presenter = selectPresenter(ctx);
  if (presenter === null) {
    return null;
  }
  let focusSeq = -1;
  for (const op of ctx.ops) {
    if (op.author !== presenter.id) {
      continue;
    }
    if (op.type === 'set_game' || op.type === 'select_game') {
      focusSeq = op.seq;
    }
  }
  let cursor: number | null = null;
  for (const op of ctx.ops) {
    if (op.seq <= focusSeq) {
      continue;
    }
    if (op.type === 'set_cursor' && op.author === presenter.id) {
      cursor = op.payload.node_id;
    }
  }
  return cursor;
}
