import { Chess } from 'chess.js';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Board from '@/components/Board';
import {
  kingInCheckSquare,
  type Position,
  parseFen,
  positionToFen,
  squareIndex,
} from '@/components/board';
import { button } from '@/components/ui';
import BoardControls from '@/features/analysis/BoardControls';
import CommentPopup from '@/features/analysis/CommentPopup';
import EngineReadout from '@/features/analysis/EngineReadout';
import EvalBar from '@/features/analysis/EvalBar';
import type { ChessEngine } from '@/features/analysis/engine';
import GameInfo from '@/features/analysis/GameInfo';
import MoveList from '@/features/analysis/MoveList';
import { buildRows } from '@/features/analysis/moveList';
import { buildNodeMap } from '@/features/analysis/nodeMap';
import type { WhiteEval } from '@/features/analysis/uci';
import { useEngine } from '@/features/analysis/useEngine';
import { fetchLegalMoves, type GameNode, type GameTree, type LegalMove } from '@/lib/api';
import type { CommentAtPlyOp, MoveAtPlyOp, SetPositionOp } from '@/protocol/ops';
import { setupPlyFromFen } from '@/store/room';

export default function Analysis({
  tree,
  presenterId = null,
  selfId = null,
  presenterCursorId = null,
  following = false,
  canEdit = false,
  engine = undefined,
  initialCursorId = null,
  onFollowChange,
  onCursorChange,
  onPlayMove,
  onComment,
  onSetPosition,
}: {
  tree: GameTree | null;
  presenterId?: string | null;
  selfId?: string | null;
  presenterCursorId?: number | null;
  following?: boolean;
  canEdit?: boolean;
  engine?: ChessEngine | null;
  initialCursorId?: number | null;
  onFollowChange?: (following: boolean) => void;
  onCursorChange?: (nodeId: number) => void;
  onPlayMove?: (payload: Omit<MoveAtPlyOp['payload'], 'game_id'>) => void;
  onComment?: (payload: Omit<CommentAtPlyOp['payload'], 'game_id'>) => void;
  onSetPosition?: (payload: Omit<SetPositionOp['payload'], 'game_id'>) => void;
}) {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  const [legalMoves, setLegalMoves] = useState<LegalMove[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);

  const presenterActive = presenterId !== null;
  const amPresenter = selfId !== null && selfId === presenterId;

  const byId = useMemo(() => buildNodeMap(tree), [tree]);

  const [currentId, setCurrentId] = useState<number | null>(null);

  /**
   * Start at the move last played (the newest move/setup node, wherever it
   * lives — variations included) once a tree arrives: a refresh restores the
   * game as it was. Untouched imports fall back to the mainline tip. A
   * one-time write during render (converges immediately) — subsequent cursor
   * changes come only from navigation, playing moves, or the presenter cursor.
   */
  if (currentId === null && tree !== null) {
    if (initialCursorId !== null && byId.has(initialCursorId)) {
      setCurrentId(initialCursorId);
    } else {
      let tip = tree.root;
      while (tip.children[0] !== undefined) {
        tip = tip.children[0];
      }
      setCurrentId(tip.id);
    }
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

  const engineState = useEngine(current?.fen ?? null, {
    engine,
    enabled: current !== null,
    positionStatus: current?.status ?? 'active',
  });

  const checkSquare = useMemo(() => kingInCheckSquare(current?.fen ?? ''), [current?.fen]);

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
        parent_id: current.id,
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

  /**
   * Free-form position editing (ADR-0011). In edit mode the board accepts
   * arbitrary piece placement: click a piece to pick it up, click any square
   * to drop it (replacing whatever is there). "Set position" validates with
   * chess.js and broadcasts a `set_position` op; the echo lands the setup
   * node under the current one.
   */
  const [editing, setEditing] = useState(false);
  const [editPos, setEditPos] = useState<Position>([]);
  const [editTurn, setEditTurn] = useState<'w' | 'b'>('w');
  const [editSelected, setEditSelected] = useState<string | null>(null);
  const [editError, setEditError] = useState(false);

  function enterEditMode() {
    setEditPos(parseFen(current?.fen ?? ''));
    setEditTurn(current?.fen?.split(' ')[1] === 'b' ? 'b' : 'w');
    setEditSelected(null);
    setEditError(false);
    setEditing(true);
  }

  function exitEditMode() {
    setEditing(false);
    setEditSelected(null);
    setEditError(false);
  }

  const handleEditSquareClick = useCallback(
    (square: string) => {
      if (editSelected === null) {
        if (editPos[squareIndex(square)] != null) {
          setEditSelected(square);
        }
        return;
      }
      if (square === editSelected) {
        setEditSelected(null);
        return;
      }
      const from = squareIndex(editSelected);
      const next = [...editPos];
      next[squareIndex(square)] = next[from] ?? null;
      next[from] = null;
      setEditPos(next);
      setEditSelected(null);
    },
    [editPos, editSelected],
  );

  function handleSetPosition() {
    if (current === null || onSetPosition === undefined) {
      return;
    }
    const fullmove = Number.parseInt(current.fen?.split(' ')[5] ?? '1', 10) || 1;
    const fen = positionToFen(editPos, editTurn, fullmove);
    try {
      new Chess(fen);
    } catch {
      setEditError(true);
      return;
    }
    onFollowChange?.(false);
    const nodeId = maxNodeId + 1;
    onSetPosition({ parent_id: current.id, fen });
    setPending((previous) => {
      const next = new Map(previous);
      next.set(nodeId, {
        id: nodeId,
        ply: setupPlyFromFen(fen) ?? current.ply + 1,
        san: null,
        from: null,
        to: null,
        promotion: null,
        comment: null,
        nags: [],
        status: 'active',
        fen,
        children: [],
      });
      return next;
    });
    setCurrentId(nodeId);
    exitEditMode();
  }

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
      const target = event.target;
      // The board's arrow keys work from anywhere on the page — except while
      // typing, while a modifier changes the meaning (browser shortcuts), or
      // while a board square has keyboard focus (the board moves the focused
      // square instead of the position, and stops propagation itself).
      if (!(target instanceof Element)) {
        return;
      }
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
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
      if ((event.key === 'c' || event.key === 'C') && canEdit) {
        setCommentOpen(true);
        handled = true;
      }
      if (handled) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tree, byId, current, navigate, lastChild, canEdit]);

  if (tree === null || current === null) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 p-8">
        <p className="m-0 text-muted">{t('analysis.noGame')}</p>
      </div>
    );
  }

  const parent = byId.get(current.id)?.parent ?? null;
  const next = current.children[0] ?? null;
  const boardLabel = t('analysis.boardLabel', { move: current.san ?? t('analysis.startPosition') });
  const evalBarLabel = evalAriaLabel(engineState.eval, t);
  const hintArrows = engineState.bestMove === null ? [] : [engineState.bestMove];

  return (
    <div data-testid="analysis-root" className="flex w-full flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-6 xl:flex-row xl:items-start">
        <div className="flex flex-col items-center gap-4">
          <div className="flex w-full items-baseline justify-between gap-4">
            <h2 className="m-0 text-display font-bold tracking-[-0.02em]">
              {tree.headers.White ?? '?'} – {tree.headers.Black ?? '?'}
            </h2>
            <p className="m-0 text-muted">{tree.result}</p>
          </div>

          <div className="flex items-stretch gap-3">
            <EvalBar
              eval={engineState.eval}
              thinking={engineState.status === 'thinking'}
              unavailable={engineState.status === 'error'}
              label={evalBarLabel}
            />
            <Board
              position={editing ? editPos : parseFen(current.fen ?? '')}
              lastMove={current.from ? { from: current.from, to: current.to ?? '' } : null}
              flipped={flipped}
              label={boardLabel}
              interactive={editing || canPlay}
              selected={editing ? editSelected : selected}
              legalTargets={editing ? [] : legalTargets}
              arrows={editing ? [] : hintArrows}
              checkSquare={editing ? null : checkSquare}
              onSquareClick={
                editing ? handleEditSquareClick : canPlay ? handleSquareClick : undefined
              }
            />
          </div>
          {editing && (
            <div
              className="flex w-[min(90vw,34rem)] flex-col gap-2 rounded-control border border-line bg-panel p-3"
              data-testid="edit-toolbar"
            >
              <p className="m-0 text-ui text-muted">{t('analysis.editModeHint')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={button({ intent: 'quiet', size: 'sm' })}
                  onClick={() => setEditTurn((turn) => (turn === 'w' ? 'b' : 'w'))}
                  data-testid="edit-turn-toggle"
                >
                  {editTurn === 'w' ? t('analysis.whiteToMove') : t('analysis.blackToMove')}
                </button>
                <button
                  type="button"
                  className={button({ intent: 'primary', size: 'sm' })}
                  onClick={handleSetPosition}
                  data-testid="set-position-button"
                >
                  {t('analysis.setPosition')}
                </button>
                <button
                  type="button"
                  className={button({ intent: 'ghost', size: 'sm' })}
                  onClick={exitEditMode}
                >
                  {t('analysis.cancelEdit')}
                </button>
              </div>
              {editError && (
                <p className="m-0 text-ui text-bad-hi" role="alert">
                  ⚠ {t('analysis.invalidSetup')}
                </p>
              )}
            </div>
          )}
          <div className="w-[min(90vw,34rem)]">
            <EngineReadout fen={current.fen ?? ''} state={engineState} />
          </div>
          {current.comment !== null && (
            <div
              className="w-[min(90vw,34rem)] rounded-control border border-line bg-panel p-3 text-body text-ink"
              data-testid="comment-bubble"
            >
              {current.comment}
            </div>
          )}
          <p className="sr-only" role="status">
            {selected !== null ? t('analysis.selected', { square: selected }) : boardLabel}
          </p>
          <BoardControls
            targets={{
              first: tree.root.id,
              prev: parent?.id ?? null,
              next: next?.id ?? null,
              last: current.children.length === 0 ? null : lastChild(current).id,
            }}
            currentPly={current.ply}
            totalPly={tree.mainline_ply_count}
            flipped={flipped}
            presenterActive={presenterActive}
            amPresenter={amPresenter}
            following={following}
            onNavigate={navigate}
            onFlip={() => setFlipped((f) => !f)}
            onFollowChange={onFollowChange ?? (() => {})}
            onOpenComment={canEdit ? () => setCommentOpen(true) : undefined}
            onToggleEdit={
              canEdit && onSetPosition !== undefined
                ? () => (editing ? exitEditMode() : enterEditMode())
                : undefined
            }
            editing={editing}
          />
          <p className="m-0 text-note text-faint">
            <kbd>←</kbd> <kbd>→</kbd> {t('analysis.shortcutNav')} · <kbd>Home</kbd> <kbd>End</kbd>{' '}
            {t('analysis.shortcutJump')} · <kbd>f</kbd> {t('analysis.shortcutFlip')} · <kbd>c</kbd>{' '}
            {t('analysis.shortcutNote')}
          </p>
          {current.status !== 'active' && (
            <p
              id="analysis-status"
              className="m-0 text-ui font-semibold text-gold-hi"
              role="status"
            >
              {t(`analysis.status.${current.status}`)}
            </p>
          )}
        </div>

        {/*
          The sidebar gets a fixed height on wide screens (the board's own
          height), so a long move list scrolls *inside* the sidebar and never
          stretches the page. Below xl it stacks full-width with a capped list.
          Comments live in a popup (the `c` key or the board controls), not
          here — the space belongs to the move list.
        */}
        <aside className="flex w-full max-w-sm flex-col gap-3 xl:h-[min(90vw,34rem)] xl:w-[340px] xl:max-w-none">
          <MoveList
            rows={rows}
            currentId={current.id}
            nodeCount={tree.node_count}
            onSelect={navigate}
          />
          <GameInfo tree={tree} />
        </aside>
      </div>

      {commentOpen && (
        <CommentPopup
          comment={current.comment}
          moveLabel={
            current.san
              ? `${Math.ceil(current.ply / 2)}${current.ply % 2 === 1 ? '.' : '...'} ${current.san}`
              : null
          }
          onSave={(text) => onComment?.({ ply: current.ply, text, node_id: current.id })}
          onClose={() => setCommentOpen(false)}
        />
      )}
    </div>
  );
}

/** The eval bar's aria-label, in words, from white's perspective. */
function evalAriaLabel(white: WhiteEval | null, t: TFunction): string {
  if (white === null) {
    return t('analysis.evalBar');
  }
  if (white.type === 'result') {
    return white.result === '1-0'
      ? t('analysis.evalWhiteWon')
      : white.result === '0-1'
        ? t('analysis.evalBlackWon')
        : t('analysis.evalDrawn');
  }
  if (white.type === 'mate') {
    return white.moves > 0
      ? t('analysis.evalMateWhite', { count: white.moves })
      : t('analysis.evalMateBlack', { count: -white.moves });
  }
  if (white.cp === 0) {
    return t('analysis.evalEqual');
  }
  return white.cp > 0
    ? t('analysis.evalWhiteBetter', { value: (white.cp / 100).toFixed(2) })
    : t('analysis.evalBlackBetter', { value: (-white.cp / 100).toFixed(2) });
}
