import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Board from '@/components/Board';
import { DRAW_COLORS, kingInCheckSquare, parseFen, pieceSrc } from '@/components/board';
import { button, statusDot } from '@/components/ui';
import BoardControls from '@/features/analysis/BoardControls';
import CommentPopup from '@/features/analysis/CommentPopup';
import EngineReadout from '@/features/analysis/EngineReadout';
import EvalBar from '@/features/analysis/EvalBar';
import type { ChessEngine } from '@/features/analysis/engine';
import GameInfo from '@/features/analysis/GameInfo';
import { legalMovesFor } from '@/features/analysis/legalMoves';
import MoveList from '@/features/analysis/MoveList';
import { buildRows } from '@/features/analysis/moveList';
import { buildNodeMap } from '@/features/analysis/nodeMap';
import { classifyOpening, loadOpeningBook, type OpeningBook } from '@/features/analysis/openings';
import SettingsTab from '@/features/analysis/SettingsTab';
import ShortcutsDialog from '@/features/analysis/ShortcutsDialog';
import SidebarTabs from '@/features/analysis/SidebarTabs';
import type { WhiteEval } from '@/features/analysis/uci';
import { useBoardKeyboard } from '@/features/analysis/useBoardKeyboard';
import { useCursor } from '@/features/analysis/useCursor';
import { useEngine } from '@/features/analysis/useEngine';
import { usePositionEditor } from '@/features/analysis/usePositionEditor';
import type { GameNode, GameTree, LegalMove } from '@/lib/api';
import type { CommentAtPlyOp, MoveAtPlyOp, SetPositionOp } from '@/protocol/ops';
import { type BoardAnnotations, setupPlyFromFen } from '@/store/room';

export default function Analysis({
  tree,
  presenterId = null,
  selfId = null,
  presenterCursorId = null,
  following = false,
  canEdit = false,
  engine = undefined,
  lastPlayedId = null,
  onFollowChange,
  onCursorChange,
  onPlayMove,
  onComment,
  onSetPosition,
  annotations = {},
  onAnnotations,
}: {
  tree: GameTree | null;
  presenterId?: string | null;
  selfId?: string | null;
  presenterCursorId?: number | null;
  following?: boolean;
  canEdit?: boolean;
  engine?: ChessEngine | null;
  lastPlayedId?: number | null;
  onFollowChange?: (following: boolean) => void;
  onCursorChange?: (nodeId: number) => void;
  onPlayMove?: (payload: Omit<MoveAtPlyOp['payload'], 'game_id'>, onError?: () => void) => void;
  onComment?: (payload: Omit<CommentAtPlyOp['payload'], 'game_id'>) => void;
  onSetPosition?: (
    payload: Omit<SetPositionOp['payload'], 'game_id'>,
    onError?: () => void,
  ) => void;
  /** Board drawings for the active game, keyed by node id. */
  annotations?: Record<number, BoardAnnotations>;
  onAnnotations?: (set: BoardAnnotations, nodeId: number) => void;
}) {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Per-viewer engine display toggles; persisted — analysis is a local aid,
  // never shared state.
  const [engineOn, setEngineOn] = useState(
    () => localStorage.getItem('blunderfest.engine') !== 'off',
  );
  const [arrowsOn, setArrowsOn] = useState(
    () => localStorage.getItem('blunderfest.hints') !== 'off',
  );

  function toggleEngine() {
    setEngineOn((on) => {
      localStorage.setItem('blunderfest.engine', on ? 'off' : 'on');
      return !on;
    });
  }

  function toggleArrows() {
    setArrowsOn((on) => {
      localStorage.setItem('blunderfest.hints', on ? 'off' : 'on');
      return !on;
    });
  }

  const presenterActive = presenterId !== null;
  const amPresenter = selfId !== null && selfId === presenterId;

  const byId = useMemo(() => buildNodeMap(tree), [tree]);

  // The opening book loads once per session; the name follows the viewed line.
  const [book, setBook] = useState<OpeningBook | null>(null);
  useEffect(() => {
    let mounted = true;
    void loadOpeningBook().then((loaded) => {
      if (mounted) {
        setBook(loaded);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const { current, navigate, maxNodeId, addPending, rollbackPending } = useCursor({
    tree,
    byId,
    following,
    presenterCursorId,
    lastPlayedId,
    amPresenter,
    onCursorChange,
    onFollowChange,
  });

  /** The opening of the viewed line, once the book has loaded. */
  const opening = useMemo(
    () => (book === null ? null : classifyOpening(book, byId, current)),
    [book, byId, current],
  );

  const canPlay = canEdit && current !== null && current.status === 'active';

  const editor = usePositionEditor({ flipped });

  const engineState = useEngine(current?.fen ?? null, {
    engine,
    // The engine pauses while the position editor owns the board.
    enabled: engineOn && current !== null && !editor.editing,
    positionStatus: current?.status ?? 'active',
  });

  const checkSquare = useMemo(() => kingInCheckSquare(current?.fen ?? ''), [current?.fen]);

  /**
   * Legal moves are computed locally with chess.js — no server round trip.
   */
  const legalMoves = useMemo(() => {
    if (!canPlay || current === null) {
      return null;
    }
    return legalMovesFor(current.fen ?? '');
  }, [canPlay, current]);

  /**
   * Reset the square selection whenever the position changes. Uses the
   * React-recommended "adjust state during render" pattern instead of an
   * effect, so no extra render pass is needed.
   */
  const [prevCurrent, setPrevCurrent] = useState(current);
  if (current !== prevCurrent) {
    setPrevCurrent(current);
    setSelected(null);
  }

  const selectedMoves = useMemo(
    () => (selected === null ? [] : (legalMoves ?? []).filter((move) => move.from === selected)),
    [selected, legalMoves],
  );

  const legalTargets = selectedMoves.map((move) => move.to);

  /**
   * Plays a legal move: the editor broadcasts the op with all node data and
   * moves to the node every client will derive (max id + 1). The node is
   * kept in `pending` until the echo applies it to the tree; a rejection
   * rolls it back. Playing a move is a local navigation, so it also breaks
   * away from the presenter.
   */
  function playMove(move: LegalMove) {
    if (current === null || onPlayMove === undefined) {
      return;
    }
    const nodeId = maxNodeId + 1;
    onPlayMove(
      {
        ply: current.ply + 1,
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        fen: move.fen,
        status: move.status,
        parent_id: current.id,
      },
      () => rollbackPending(nodeId, current.id),
    );
    addPending({
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
    setSelected(null);
    navigate(nodeId);
  }

  function handleSetPosition() {
    if (current === null || onSetPosition === undefined) {
      return;
    }
    const fen = editor.buildFen(current.fen ?? null);
    if (fen === null) {
      return;
    }
    const nodeId = maxNodeId + 1;
    onSetPosition({ parent_id: current.id, fen }, () => rollbackPending(nodeId, current.id));
    addPending({
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
    navigate(nodeId);
    editor.exitEditMode();
  }

  /**
   * Drag & drop. Play mode: a drag to a legal target plays the move; a drag
   * anywhere else falls back to selecting the piece. Edit mode: free-form
   * placement, and dropping off the board deletes the piece.
   */
  function handleDragMove(from: string, to: string | null) {
    if (editor.editing) {
      editor.handleEditDrag(from, to);
      return;
    }
    if (!canPlay || to === null) {
      return;
    }
    const move = (legalMoves ?? []).find((m) => m.from === from && m.to === to);
    if (move !== undefined) {
      playMove(move);
      return;
    }
    if ((legalMoves ?? []).some((m) => m.from === from)) {
      setSelected(from);
    }
  }

  function handleSquareClick(square: string) {
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
  }

  const rows = useMemo(() => buildRows(tree), [tree]);

  const handleFlip = useCallback(() => setFlipped((value) => !value), []);
  const openComment = useCallback(() => setCommentOpen(true), []);

  useBoardKeyboard({
    tree,
    byId,
    current,
    navigate,
    canEdit,
    annotations,
    onAnnotations,
    onFlip: handleFlip,
    onOpenComment: openComment,
  });

  const nodeAnnotations = (current !== null ? annotations[current.id] : undefined) ?? {
    arrows: [],
    highlights: [],
  };

  const handleDrawArrow = useCallback(
    (from: string, to: string, color: string) => {
      if (current === null) {
        return;
      }
      // Redrawing an identical arrow removes it (lichess/chess.com style).
      const existing = nodeAnnotations.arrows.find((a) => a.from === from && a.to === to);
      onAnnotations?.(
        {
          arrows:
            existing !== undefined
              ? nodeAnnotations.arrows.filter((a) => a !== existing)
              : [...nodeAnnotations.arrows, { from, to, color }],
          highlights: nodeAnnotations.highlights,
        },
        current.id,
      );
    },
    [nodeAnnotations, current, onAnnotations],
  );

  const handleToggleHighlight = useCallback(
    (square: string, color: string) => {
      if (current === null) {
        return;
      }
      const exists = nodeAnnotations.highlights.some((h) => h.square === square);
      onAnnotations?.(
        {
          arrows: nodeAnnotations.arrows,
          highlights: exists
            ? nodeAnnotations.highlights.filter((h) => h.square !== square)
            : [...nodeAnnotations.highlights, { square, color }],
        },
        current.id,
      );
    },
    [nodeAnnotations, current, onAnnotations],
  );

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
  const hintArrows =
    engineOn && arrowsOn && engineState.bestMove !== null
      ? [{ ...engineState.bestMove, hint: true }]
      : [];

  const boardArrows = [...hintArrows, ...nodeAnnotations.arrows];

  return (
    <div data-testid="analysis-root" className="flex w-full flex-col items-center gap-3 md:gap-6">
      <div className="flex flex-col items-center gap-4 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex w-full items-baseline justify-between gap-4">
            <h2 className="m-0 text-display font-bold tracking-[-0.02em]">
              {tree.headers.White ?? '?'} – {tree.headers.Black ?? '?'}
            </h2>
            <p className="m-0 text-muted">{tree.result}</p>
          </div>
          {/*
            Fixed-height slot: the board must never shift when the name
            appears or changes — empty at the start position.
          */}
          <p
            data-testid="opening-name"
            aria-hidden={opening === null}
            className="m-0 -mt-2 h-[1.125rem] w-full text-note font-semibold text-gold-hi"
          >
            {opening === null ? '' : `${opening.eco} · ${opening.name}`}
          </p>

          {/*
            The edit palette sits on each side's home edge (black pieces on
            black's side, white on white's — swapped when flipped), like
            lichess's editor. No scroll strip.
          */}
          <div className="flex items-stretch gap-3">
            {/*
              Fixed-width slot for the eval bar / edit palette: it keeps its
              width even when empty (engine off), so the board and sidebar
              never shift when the engine display toggles.
            */}
            <div
              className="flex w-10 shrink-0 flex-col justify-center self-stretch"
              data-testid="board-left-slot"
            >
              {editor.editing ? null : engineOn ? (
                <EvalBar
                  eval={engineState.eval}
                  thinking={engineState.status === 'thinking'}
                  unavailable={engineState.status === 'error'}
                  label={evalBarLabel}
                />
              ) : null}
            </div>
            {/*
              The strips live in the board's own column, so the trays align
              exactly with the board's edges on both axes.
            */}
            <div className="flex flex-col items-stretch gap-2">
              {editor.editing && (
                <PaletteStrip editor={editor} color={flipped ? 'w' : 'b'} side="top" />
              )}
              <Board
                position={editor.editing ? editor.editPos : parseFen(current.fen ?? '')}
                lastMove={current.from ? { from: current.from, to: current.to ?? '' } : null}
                flipped={flipped}
                label={boardLabel}
                interactive={editor.editing || canPlay || canEdit}
                selected={editor.editing ? editor.editSelected : selected}
                legalTargets={editor.editing ? [] : legalTargets}
                arrows={editor.editing ? [] : boardArrows}
                highlights={editor.editing ? [] : nodeAnnotations.highlights}
                checkSquare={editor.editing ? null : checkSquare}
                onSquareClick={
                  editor.editing
                    ? editor.handleEditSquareClick
                    : canPlay
                      ? handleSquareClick
                      : undefined
                }
                onDragMove={editor.editing || canPlay ? handleDragMove : undefined}
                onDrawArrow={canEdit && !editor.editing ? handleDrawArrow : undefined}
                onToggleHighlight={canEdit && !editor.editing ? handleToggleHighlight : undefined}
                drawColor={drawColor}
                onDrawColorChange={canEdit && !editor.editing ? setDrawColor : undefined}
              />
              {editor.editing && (
                <div className="flex w-full items-center justify-between">
                  <PaletteStrip editor={editor} color={flipped ? 'b' : 'w'} side="bottom" />
                  {/* The eraser stands apart, flush with the board's right edge. */}
                  <button
                    type="button"
                    aria-pressed={editor.editBrush === 'erase'}
                    aria-label={t('analysis.eraser')}
                    data-testid="eraser-button"
                    className={`grid h-9 w-9 place-items-center rounded-control border text-base transition-colors ${
                      editor.editBrush === 'erase'
                        ? 'border-gold/60 bg-gold/20 text-gold-hi'
                        : 'border-line bg-panel text-muted hover:bg-raised'
                    }`}
                    onClick={() => editor.toggleBrush('erase')}
                  >
                    ⌫
                  </button>
                </div>
              )}
            </div>
          </div>
          {editor.editing && (
            <div
              className="flex w-[min(90vw,34rem)] flex-col gap-2 rounded-control border border-line bg-panel p-3"
              data-testid="edit-toolbar"
            >
              <p className="m-0 text-ui text-muted">{t('analysis.editModeHint')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={button({ intent: 'quiet', size: 'sm' })}
                  onClick={editor.toggleTurn}
                  data-testid="edit-turn-toggle"
                >
                  {editor.editTurn === 'w' ? t('analysis.whiteToMove') : t('analysis.blackToMove')}
                </button>
                <button
                  type="button"
                  className={button({ intent: 'quiet', size: 'sm' })}
                  onClick={editor.clearBoard}
                  data-testid="edit-clear-button"
                >
                  {t('analysis.clearBoard')}
                </button>
                <button
                  type="button"
                  className={button({ intent: 'quiet', size: 'sm' })}
                  onClick={() => editor.resetPosition(current.fen ?? null)}
                  data-testid="edit-reset-button"
                >
                  {t('analysis.resetPosition')}
                </button>
                <button
                  type="button"
                  className={button({ intent: 'primary', size: 'sm' })}
                  onClick={handleSetPosition}
                  data-testid="set-position-button"
                >
                  {t('analysis.done')}
                </button>
                <button
                  type="button"
                  className={button({ intent: 'ghost', size: 'sm' })}
                  onClick={editor.exitEditMode}
                >
                  {t('analysis.cancelEdit')}
                </button>
              </div>
              {editor.editError && (
                <p className="m-0 text-ui text-bad-hi" role="alert">
                  ⚠ {t('analysis.invalidSetup')}
                </p>
              )}
            </div>
          )}
          {editor.editing && engineOn ? (
            <div
              className="flex h-9 w-[min(90vw,34rem)] items-center gap-2 rounded-control border border-gold/30 bg-gold/10 px-3"
              data-testid="engine-paused"
            >
              <span className={statusDot({ tone: 'warn', pulse: true })} />
              <span className="text-ui text-gold-hi">{t('analysis.enginePaused')}</span>
            </div>
          ) : editor.editing ? null : engineOn ? (
            <div className="w-[min(90vw,34rem)]">
              <EngineReadout fen={current.fen ?? ''} state={engineState} />
            </div>
          ) : null}
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
            flipped={flipped}
            presenterActive={presenterActive}
            amPresenter={amPresenter}
            following={following}
            onFlip={handleFlip}
            onFollowChange={onFollowChange ?? (() => {})}
            onOpenComment={canEdit ? openComment : undefined}
            onToggleEdit={
              canEdit && onSetPosition !== undefined
                ? () =>
                    editor.editing
                      ? editor.exitEditMode()
                      : editor.enterEditMode(current?.fen ?? null)
                : undefined
            }
            editing={editor.editing}
            drawColorPicker={canEdit ? { current: drawColor, onChange: setDrawColor } : undefined}
            clearDrawings={
              canEdit
                ? {
                    disabled:
                      current === null ||
                      (nodeAnnotations.arrows.length === 0 &&
                        nodeAnnotations.highlights.length === 0),
                    onClear: () => {
                      if (current !== null) {
                        onAnnotations?.({ arrows: [], highlights: [] }, current.id);
                      }
                    },
                  }
                : undefined
            }
          />
          <p className="m-0 hidden text-note text-faint md:block">
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
        <aside className="flex w-full max-w-[min(100%,24rem)] flex-col gap-3 xl:h-[min(90vw,34rem)] xl:w-[340px]">
          <SidebarTabs
            tabs={[
              {
                id: 'analysis',
                label: t('analysis.moves'),
                content: (
                  <>
                    <MoveList
                      rows={rows}
                      currentId={current.id}
                      onSelect={navigate}
                      navTargets={{
                        first: tree.root.id,
                        prev: parent?.id ?? null,
                        next: next?.id ?? null,
                        last: current.children.length === 0 ? null : lastChildOf(current).id,
                      }}
                      currentPly={current.ply}
                      totalPly={tree.mainline_ply_count}
                    />
                    <GameInfo tree={tree} />
                  </>
                ),
              },
              {
                id: 'settings',
                label: t('analysis.settings'),
                content: (
                  <SettingsTab
                    engineOn={engineOn}
                    arrowsOn={arrowsOn}
                    onToggleEngine={toggleEngine}
                    onToggleArrows={toggleArrows}
                  />
                ),
              },
            ]}
          />
        </aside>
      </div>

      {editor.paletteGhost !== null && (
        <img
          src={pieceSrc(editor.paletteGhost.piece)}
          alt=""
          draggable={false}
          data-testid="palette-ghost"
          className="pointer-events-none fixed z-50 h-12 w-12 -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ left: editor.paletteGhost.x, top: editor.paletteGhost.y }}
        />
      )}

      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}

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

/** The last node of the mainline (deepest first-child chain). */
function lastChildOf(node: GameNode): GameNode {
  return node.children[0] ? lastChildOf(node.children[0]) : node;
}

/**
 * One edge of the edit palette: a color's six pieces in a horizontal strip.
 * The parent places it on that side's home edge (top for black, bottom for
 * white, swapped when flipped); the eraser rides the bottom strip.
 */
function PaletteStrip({
  editor,
  color,
  side,
}: {
  editor: ReturnType<typeof usePositionEditor>;
  color: 'w' | 'b';
  side: 'top' | 'bottom';
}) {
  const { t } = useTranslation();
  // The tray is a step lighter than the page surface: quiet, but the black
  // pieces still read. Left-aligned (the eraser floats right of the bottom
  // strip, so centering would overlap it).
  return (
    <div
      className="flex items-center justify-start gap-1 self-start rounded-control border border-line bg-overlay px-2 py-1"
      data-testid={side === 'top' ? 'edit-palette' : undefined}
    >
      {(['k', 'q', 'r', 'b', 'n', 'p'] as const).map((kind) => {
        const active =
          editor.editBrush !== null &&
          editor.editBrush !== 'erase' &&
          editor.editBrush.color === color &&
          editor.editBrush.kind === kind;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={active}
            aria-label={t('analysis.pieceLabel', {
              color: t(color === 'w' ? 'analysis.sideWhite' : 'analysis.sideBlack'),
              piece: t(`analysis.pieces.${kind}`),
            })}
            className={`grid h-9 w-9 place-items-center rounded-control leading-none transition-colors ${
              active ? 'bg-gold/20 ring-1 ring-gold/50' : 'hover:bg-raised'
            }`}
            onPointerDown={(event) => editor.handlePalettePointerDown({ color, kind }, event)}
            onClick={() => editor.toggleBrush({ color, kind })}
          >
            <img
              src={pieceSrc({ color, kind })}
              alt=""
              draggable={false}
              className="h-7 w-7 select-none"
            />
          </button>
        );
      })}
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
