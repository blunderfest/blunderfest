import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { Entry } from '@/features/analysis/nodeMap';
import type { GameNode, GameTree } from '@/lib/api';

type CursorState = {
  currentId: number | null;
  /** Echoed-but-not-yet-applied nodes from this editor, keyed by node id. */
  pending: Map<number, GameNode>;
};

type CursorAction =
  | { type: 'navigate'; id: number }
  | { type: 'init'; id: number }
  | { type: 'follow_tail'; lastPlayedId: number | null; lastPlayedParentId: number | null }
  | { type: 'add_pending'; node: GameNode }
  | { type: 'prune_pending'; ids: number[] }
  | { type: 'rollback'; nodeId: number; fallbackId: number };

function cursorReducer(state: CursorState, action: CursorAction): CursorState {
  switch (action.type) {
    case 'navigate':
      return { ...state, currentId: action.id };

    case 'init':
      return state.currentId === null ? { ...state, currentId: action.id } : state;

    case 'follow_tail': {
      const { lastPlayedId, lastPlayedParentId } = action;
      if (lastPlayedId === null || lastPlayedId === state.currentId) {
        return state;
      }
      return lastPlayedParentId === state.currentId ? { ...state, currentId: lastPlayedId } : state;
    }

    case 'add_pending': {
      const next = new Map(state.pending);
      next.set(action.node.id, action.node);
      return { ...state, pending: next };
    }

    case 'prune_pending': {
      const next = new Map(state.pending);
      for (const id of action.ids) {
        next.delete(id);
      }
      return { ...state, pending: next };
    }

    case 'rollback': {
      if (!state.pending.has(action.nodeId)) {
        return state;
      }
      const next = new Map(state.pending);
      for (const id of next.keys()) {
        if (id >= action.nodeId) {
          next.delete(id);
        }
      }
      // If the cursor sits on a node that just got rolled back, return to
      // the position the rejected op was played from.
      const currentId =
        state.currentId !== null &&
        state.currentId >= action.nodeId &&
        state.pending.has(state.currentId)
          ? action.fallbackId
          : state.currentId;
      return { currentId, pending: next };
    }
  }
}

/**
 * The analysis cursor: which node is on the board, and why.
 *
 * Owns three intertwined pieces of state (kept in one reducer so
 * transitions always read fresh state, never a stale render closure):
 *
 * - **Local navigation** (`currentId`) — moving through the tree breaks
 *   away from the presenter.
 * - **Follow the tail** — when a move/setup lands from someone else, the
 *   cursor advances only if it sits on the position the move was played
 *   from, so the game continues under your eyes but browsing mid-history is
 *   never yanked forward.
 * - **Pending nodes** — moves the editor broadcast that haven't echoed back
 *   yet, rendered like regular nodes so the board feels instant. Echoed
 *   nodes take precedence and pending entries are pruned as they land; a
 *   rejected op is rolled back (`rollbackPending`).
 */
export function useCursor({
  tree,
  byId,
  following,
  presenterCursorId,
  lastPlayedId,
  amPresenter,
  startAtRoot = false,
  initialNodeId = null,
  onCursorChange,
  onLocalCursor,
  onFollowChange,
}: {
  tree: GameTree | null;
  byId: Map<number, Entry>;
  following: boolean;
  presenterCursorId: number | null;
  lastPlayedId: number | null;
  amPresenter: boolean;
  /** Open on the initial position instead of the tail (fresh imports). */
  startAtRoot?: boolean;
  /**
   * The node to open on when the tree arrives and nothing else applies —
   * e.g. an added historical game opens at the candidate's move. Room
   * activity (a played move) still wins over it.
   */
  initialNodeId?: number | null;
  onCursorChange?: (nodeId: number) => void;
  /**
   * Reports every local cursor change — navigation, the initial position,
   * follow-tail, rollbacks — regardless of presenting. The room view uses
   * it to persist the per-game cursor, so switching games and back restores
   * where you were.
   */
  onLocalCursor?: (nodeId: number) => void;
  onFollowChange?: (following: boolean) => void;
}) {
  const [state, dispatch] = useReducer(cursorReducer, { currentId: null, pending: new Map() });
  const { currentId, pending } = state;

  /**
   * Start at the move last played (the newest move/setup node, wherever it
   * lives — variations included) once a tree arrives: a refresh restores the
   * game as it was. Untouched imports fall back to the requested opening
   * node (`initialNodeId`), then the mainline tip — except a game just
   * imported here (`startAtRoot`), which opens on the initial position so
   * it can be reviewed from the beginning. A one-time write during render
   * (converges immediately) — subsequent cursor changes come only from
   * navigation, playing moves, or the presenter cursor.
   */
  if (currentId === null && tree !== null) {
    if (startAtRoot) {
      dispatch({ type: 'init', id: tree.root.id });
    } else if (lastPlayedId !== null && byId.has(lastPlayedId)) {
      dispatch({ type: 'init', id: lastPlayedId });
    } else if (initialNodeId !== null && byId.has(initialNodeId)) {
      dispatch({ type: 'init', id: initialNodeId });
    } else {
      let tip = tree.root;
      while (tip.children[0] !== undefined) {
        tip = tip.children[0];
      }
      dispatch({ type: 'init', id: tip.id });
    }
  }

  /**
   * Follow the tail. Only runs when the newest op CHANGES (a move actually
   * arrived) — never because the cursor moved. Otherwise navigating back to
   * the parent of the last move would bounce you forward again.
   */
  const lastPlayedParentId =
    lastPlayedId !== null ? (byId.get(lastPlayedId)?.parent?.id ?? null) : null;
  useEffect(() => {
    dispatch({ type: 'follow_tail', lastPlayedId, lastPlayedParentId });
  }, [lastPlayedId, lastPlayedParentId]);

  /**
   * While following, the presenter's cursor wins; otherwise the viewer's own
   * cursor. Falls back to the root when the cursor no longer exists (tree
   * replaced wholesale), and to the pending node while an echo is in flight.
   */
  const current: GameNode | null = useMemo(() => {
    const id =
      following && presenterCursorId !== null && byId.has(presenterCursorId)
        ? presenterCursorId
        : currentId;
    if (id !== null) {
      const entry = byId.get(id);
      if (entry !== undefined) {
        return entry.node;
      }
      const pendingNode = pending.get(id);
      if (pendingNode !== undefined) {
        return pendingNode;
      }
    }
    if (tree === null) {
      return null;
    }
    return byId.get(tree.root.id)?.node ?? null;
  }, [following, presenterCursorId, currentId, byId, pending, tree]);

  /** Drop pending entries whose echo has landed in the tree. */
  useEffect(() => {
    if (pending.size === 0) {
      return;
    }
    const landed = [...pending.keys()].filter((id) => byId.has(id));
    if (landed.length > 0) {
      dispatch({ type: 'prune_pending', ids: landed });
    }
  }, [byId, pending]);

  /** Broadcast our own cursor when presenting. */
  useEffect(() => {
    if (amPresenter && currentId !== null && onCursorChange) {
      onCursorChange(currentId);
    }
  }, [amPresenter, currentId, onCursorChange]);

  /** Report every local cursor change (the caller persists it per game). */
  useEffect(() => {
    if (currentId !== null && onLocalCursor) {
      onLocalCursor(currentId);
    }
  }, [currentId, onLocalCursor]);

  /**
   * Local navigation: breaks away from the presenter and moves the cursor.
   */
  const navigate = useCallback(
    (id: number) => {
      onFollowChange?.(false);
      dispatch({ type: 'navigate', id });
    },
    [onFollowChange],
  );

  const maxNodeId = useMemo(() => {
    let max = -1;
    for (const { node } of byId.values()) {
      if (node.id > max) {
        max = node.id;
      }
    }
    for (const id of pending.keys()) {
      if (id > max) {
        max = id;
      }
    }
    return max;
  }, [byId, pending]);

  /** Keeps a freshly played (or set-up) node visible until its echo lands. */
  const addPending = useCallback((node: GameNode) => {
    dispatch({ type: 'add_pending', node });
  }, []);

  /**
   * The server rejected the op for `nodeId` (op limit, a mid-edit demote):
   * drop it — and anything played on top of it, whose parent never landed —
   * and return the cursor to the position the op was played from.
   */
  const rollbackPending = useCallback((nodeId: number, fallbackId: number) => {
    dispatch({ type: 'rollback', nodeId, fallbackId });
  }, []);

  return {
    current,
    navigate,
    maxNodeId,
    addPending,
    rollbackPending,
  };
}
