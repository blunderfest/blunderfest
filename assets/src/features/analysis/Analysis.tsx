import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Board from '@/components/Board';
import { parseFen } from '@/components/board';
import BoardControls from '@/features/analysis/BoardControls';
import GameInfo from '@/features/analysis/GameInfo';
import MoveList from '@/features/analysis/MoveList';
import { buildRows } from '@/features/analysis/moveList';
import NodeComment from '@/features/analysis/NodeComment';
import { buildNodeMap } from '@/features/analysis/nodeMap';
import { fetchLegalMoves, type GameNode, type GameTree, type LegalMove } from '@/lib/api';
import type { CommentAtPlyOp, MoveAtPlyOp } from '@/protocol/ops';

export default function Analysis({
  tree,
  presenterId = null,
  selfId = null,
  presenterCursorId = null,
  following = false,
  canEdit = false,
  onFollowChange,
  onCursorChange,
  onPlayMove,
  onComment,
}: {
  tree: GameTree | null;
  presenterId?: string | null;
  selfId?: string | null;
  presenterCursorId?: number | null;
  following?: boolean;
  canEdit?: boolean;
  onFollowChange?: (following: boolean) => void;
  onCursorChange?: (nodeId: number) => void;
  onPlayMove?: (payload: Omit<MoveAtPlyOp['payload'], 'game_id'>) => void;
  onComment?: (payload: Omit<CommentAtPlyOp['payload'], 'game_id'>) => void;
}) {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  const [legalMoves, setLegalMoves] = useState<LegalMove[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const presenterActive = presenterId !== null;
  const amPresenter = selfId !== null && selfId === presenterId;

  const byId = useMemo(() => buildNodeMap(tree), [tree]);

  const [currentId, setCurrentId] = useState<number | null>(null);

  /**
   * Start at the root once a tree arrives. A one-time write during render
   * (converges immediately) — subsequent cursor changes come only from
   * navigation, playing moves, or the presenter cursor.
   */
  if (currentId === null && tree !== null) {
    setCurrentId(tree.root.id);
  }

  /**
   * Nodes the editor played that have been broadcast but not yet applied
   * back through the echo. Rendered like regular nodes so the board can show
   * the move immediately; the replayed tree takes precedence once it arrives.
   */
  const [pending, setPending] = useState<Map<number, GameNode>>(new Map());

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

  const canPlay = canEdit && current !== null && current.status === 'active';

  /**
   * Fetch legal moves for the position when the viewer can play, so the
   * board can hint and validate clicks.
   */
  useEffect(() => {
    if (!canPlay) {
      setLegalMoves(null);
      setSelected(null);
      return;
    }
    let cancelled = false;
    setLegalMoves(null);
    setSelected(null);
    fetchLegalMoves(current.fen ?? '')
      .then(({ moves }) => {
        if (!cancelled) {
          setLegalMoves(moves);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLegalMoves(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canPlay, current?.fen]);

  /**
   * Local navigation: breaks away from the presenter and moves the cursor.
   */
  const navigate = useCallback(
    (id: number) => {
      onFollowChange?.(false);
      setCurrentId(id);
    },
    [onFollowChange],
  );

  const selectedMoves = useMemo(
    () => (selected === null ? [] : (legalMoves ?? []).filter((move) => move.from === selected)),
    [selected, legalMoves],
  );

  const legalTargets = selectedMoves.map((move) => move.to);

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

  /**
   * Plays a legal move: the editor broadcasts the op with all node data and
   * moves to the node every client will derive (max id + 1). The node is
   * kept in `pending` until the echo applies it to the tree. Playing a move
   * is a local navigation, so it also breaks away from the presenter.
   */
  const playMove = useCallback(
    (move: LegalMove) => {
      if (current === null || onPlayMove === undefined) {
        return;
      }
      onFollowChange?.(false);
      const nodeId = maxNodeId + 1;
      onPlayMove({
        ply: current.ply + 1,
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        fen: move.fen,
        status: move.status,
      });
      setPending((previous) => {
        const next = new Map(previous);
        next.set(nodeId, {
          id: nodeId,
          ply: current.ply + 1,
          san: move.san,
          from: move.from,
          to: move.to,
          promotion: move.promotion,
          comment: null,
          nags: [],
          status: move.status,
          fen: move.fen,
          children: [],
        });
        return next;
      });
      setSelected(null);
      setCurrentId(nodeId);
    },
    [current, onPlayMove, onFollowChange, maxNodeId],
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!canPlay) {
        return;
      }
      const target = selectedMoves.find((move) => move.to === square);
      if (target !== undefined) {
        playMove(target);
        return;
      }
      if ((legalMoves ?? []).some((move) => move.from === square)) {
        setSelected(square);
      } else {
        setSelected(null);
      }
    },
    [canPlay, selectedMoves, legalMoves, playMove],
  );

  /**
   * Broadcast our own cursor when presenting.
   */
  useEffect(() => {
    if (amPresenter && currentId !== null && onCursorChange) {
      onCursorChange(currentId);
    }
  }, [amPresenter, currentId, onCursorChange]);

  const rows = useMemo(() => buildRows(tree), [tree]);

  const lastChild = useCallback(
    (node: GameNode): GameNode => (node.children[0] ? lastChild(node.children[0]) : node),
    [],
  );

  useEffect(() => {
    if (!tree || !current) {
      return;
    }
    const parent = byId.get(current.id)?.parent ?? null;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        return;
      }
      let handled = false;
      if (event.key === 'ArrowRight' && current.children[0]) {
        navigate(current.children[0].id);
        handled = true;
      }
      if (event.key === 'ArrowLeft' && parent) {
        navigate(parent.id);
        handled = true;
      }
      if (event.key === 'Home') {
        navigate(tree.root.id);
        handled = true;
      }
      if (event.key === 'End') {
        navigate(lastChild(current).id);
        handled = true;
      }
      if (event.key === 'f' || event.key === 'F') {
        setFlipped((value) => !value);
        handled = true;
      }
      if (handled) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tree, byId, current, navigate, lastChild]);

  if (tree === null || current === null) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 p-8">
        <p className="m-0 text-muted">{t('analysis.noGame')}</p>
      </div>
    );
  }

  const parent = byId.get(current.id)?.parent ?? null;
  const next = current.children[0] ?? null;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="m-0 text-2xl tracking-[-0.02em]">
            {tree.headers.White ?? '?'} – {tree.headers.Black ?? '?'}
          </h2>
          <p className="m-0 text-muted">{tree.result}</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Board
          position={parseFen(current.fen ?? '')}
          lastMove={current.from ? { from: current.from, to: current.to ?? '' } : null}
          flipped={flipped}
          label={t('analysis.boardLabel', { move: current.san ?? t('analysis.startPosition') })}
          interactive={canPlay}
          selected={selected}
          legalTargets={legalTargets}
          onSquareClick={canPlay ? handleSquareClick : undefined}
        />
        {canPlay && (
          <p className="m-0 text-xs text-muted" role="status">
            {t('analysis.playHint')}
          </p>
        )}
        <BoardControls
          targets={{
            first: tree.root.id,
            prev: parent?.id ?? null,
            next: next?.id ?? null,
            last: current.children.length === 0 ? null : lastChild(current).id,
          }}
          flipped={flipped}
          presenterActive={presenterActive}
          amPresenter={amPresenter}
          following={following}
          onNavigate={navigate}
          onFlip={() => setFlipped((f) => !f)}
          onFollowChange={onFollowChange ?? (() => {})}
        />
        <p className="m-0 text-xs text-muted">
          <kbd>←</kbd> <kbd>→</kbd> {t('analysis.shortcutNav')} · <kbd>Home</kbd> <kbd>End</kbd>{' '}
          {t('analysis.shortcutJump')} · <kbd>f</kbd> {t('analysis.shortcutFlip')}
        </p>
        {current.status !== 'active' && (
          <p id="analysis-status" className="m-0 text-sm font-semibold text-warn" role="status">
            {t(`analysis.status.${current.status}`)}
          </p>
        )}
      </div>

      <NodeComment
        comment={current.comment}
        canEdit={canEdit}
        onSave={(text) => onComment?.({ ply: current.ply, text })}
      />

      <MoveList rows={rows} currentId={current.id} onSelect={navigate} />

      <GameInfo tree={tree} />
    </div>
  );
}
