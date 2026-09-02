import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Board, { type BoardArrow } from '@/components/Board';
import { parseFen, pieceSrc } from '@/components/board';
import { button } from '@/components/ui';
import BoardControls from '@/features/analysis/BoardControls';
import EvalBar from '@/features/analysis/EvalBar';
import GameActions from '@/features/analysis/GameActions';
import NavControls, { type NavTargets } from '@/features/analysis/NavControls';
import type { Opening } from '@/features/analysis/openings';
import type { WhiteEval } from '@/features/analysis/uci';
import type { DragFlag } from '@/features/analysis/useDragFlag';
import type { EngineState } from '@/features/analysis/useEngine';
import type { usePositionEditor } from '@/features/analysis/usePositionEditor';
import type { GameNode, GameTree } from '@/lib/api';
import type { BoardAnnotations } from '@/store/roomStore';

/**
 * The board column: the game title, the board with its eval bar and edit
 * palettes, the move navigation, comments, board controls and hints. Pure
 * presentation — all state and handlers live in `Analysis` and arrive as
 * props (the board is a shared canvas; splitting its wiring out of the
 * orchestrator keeps `Analysis` readable without a context).
 */
export default function BoardColumn({
  tree,
  current,
  opening,
  engineOn,
  engineState,
  flipped,
  editor,
  selected,
  legalTargets,
  arrows,
  highlights,
  checkSquare,
  dragFlag,
  drawColor,
  canPlay,
  canEdit,
  navTargets,
  onSquareClick,
  onDragMove,
  onDragHover,
  onDrawArrow,
  onToggleHighlight,
  onDrawColorChange,
  drawColorPicker,
  clearDrawings,
  onFlip,
  onOpenComment,
  onFindExamples,
  onSelect,
  onSetPosition,
}: {
  tree: GameTree;
  current: GameNode;
  opening: Opening | null;
  engineOn: boolean;
  engineState: EngineState;
  flipped: boolean;
  editor: ReturnType<typeof usePositionEditor>;
  selected: string | null;
  legalTargets: string[];
  arrows: BoardArrow[];
  highlights: BoardAnnotations['highlights'];
  checkSquare: string | null;
  dragFlag: DragFlag | null;
  drawColor: string;
  canPlay: boolean;
  canEdit: boolean;
  navTargets: NavTargets;
  onSquareClick?: (square: string) => void;
  onDragMove?: (from: string, to: string | null) => void;
  onDragHover: (from: string, to: string | null) => void;
  onDrawArrow?: (from: string, to: string, color: string) => void;
  onToggleHighlight?: (square: string, color: string) => void;
  onDrawColorChange?: (color: string) => void;
  drawColorPicker?: { current: string; onChange: (color: string) => void };
  clearDrawings?: { disabled: boolean; onClear: () => void };
  onFlip: () => void;
  onOpenComment?: () => void;
  /** Opens the historical-examples browser for the cursor position (editors). */
  onFindExamples?: () => void;
  onSelect: (nodeId: number) => void;
  onSetPosition?: () => void;
}) {
  const { t } = useTranslation();

  const boardLabel = useMemo(
    () => t('analysis.boardLabel', { move: current.san ?? t('analysis.startPosition') }),
    [current.san, t],
  );
  const evalBarLabel = evalAriaLabel(engineState.eval, t);

  return (
    <div className="order-1 flex min-w-0 flex-1 flex-col items-center gap-2 px-3 py-3 xl:min-h-0">
      {/*
        Compact game header (v0's 36px row): the players + the opening on
        one line, the actions on the right. The meta shows just the ECO +
        opening name — the viewed move lives in the timeline header and the
        move list. The STM chip is xl-only (the board's edge strip already
        marks the mover on narrower widths).
      */}
      <div className="flex h-9 w-full shrink-0 items-center gap-2 border-b border-line">
        <h2 className="m-0 min-w-0 shrink-0 truncate text-ui font-semibold">
          {tree.headers.White ?? '?'} – {tree.headers.Black ?? '?'}
        </h2>
        <p
          data-testid="opening-name"
          aria-hidden={opening === null}
          className="m-0 min-w-0 flex-1 truncate text-note text-muted"
        >
          {opening === null ? '' : `${opening.eco} · ${opening.name}`}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {!editor.editing && (
            <span
              data-testid="stm-chip"
              title="Side to move"
              aria-live="polite"
              className="mr-1 hidden items-center gap-1.5 whitespace-nowrap rounded-chip border border-line px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.11em] text-muted xl:flex"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${(current.fen ?? '').split(/\s+/u)[1] === 'w' ? 'bg-white' : 'bg-ink'} border border-line`}
                aria-hidden="true"
              />
              {(current.fen ?? '').split(/\s+/u)[1] === 'w'
                ? t('analysis.whiteToMove')
                : t('analysis.blackToMove')}
            </span>
          )}
          <p className="m-0 whitespace-nowrap text-muted">{tree.result}</p>
          <GameActions tree={tree} />
        </div>
      </div>

      {/*
        The board column is always centered. The eval bar hangs off its
        left edge, out of flow, so toggling the engine (or the edit
        palette) never shifts the board. The ml-13 margin reserves that
        slot whenever the bar is shown: centering alone would let it
        cross the content's left edge — the board's width formula
        (`--board-size`, app.css) reserves exactly this slot.

        The edit palette sits on each side's home edge (black pieces on
        black's side, white on white's — swapped when flipped), like
        lichess's editor. No scroll strip.
      */}
      <div
        className={`relative flex flex-col items-stretch gap-2 ${
          !editor.editing && engineOn ? 'ml-13' : ''
        }`}
        data-tour="board"
      >
        {!editor.editing && engineOn && (
          <div
            className="absolute top-0 right-full bottom-0 mr-3 flex w-10 flex-col justify-center"
            data-testid="board-left-slot"
          >
            <EvalBar
              eval={engineState.eval}
              thinking={engineState.status === 'thinking'}
              unavailable={engineState.status === 'error'}
              flipped={flipped}
              label={evalBarLabel}
            />
          </div>
        )}
        {editor.editing && <PaletteStrip editor={editor} color={flipped ? 'w' : 'b'} side="top" />}
        {/*
          Side-to-move edge strip: the mover "owns" their board edge (white
          = bottom, black = top, swapped when flipped). Sits OUTSIDE the
          board's border so it never covers squares.
        */}
        {!editor.editing &&
          (() => {
            const whiteStm = (current.fen ?? '').split(/\s+/u)[1] === 'w';
            const atBottom = whiteStm !== flipped; // white bottom; swap when flipped
            return (
              <span
                data-testid="stm-edge"
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-0 z-10 h-1 rounded-full ${
                  atBottom ? '-bottom-1.5' : '-top-1.5'
                } ${whiteStm ? 'bg-white' : 'bg-ink'} border border-line`}
              />
            );
          })()}
        <Board
          position={editor.editing ? editor.editPos : parseFen(current.fen ?? '')}
          lastMove={current.from ? { from: current.from, to: current.to ?? '' } : null}
          flipped={flipped}
          label={boardLabel}
          interactive={editor.editing || canPlay || canEdit}
          selected={editor.editing ? editor.editSelected : selected}
          legalTargets={editor.editing ? [] : legalTargets}
          arrows={editor.editing ? [] : arrows}
          highlights={editor.editing ? [] : highlights}
          checkSquare={editor.editing ? null : checkSquare}
          onSquareClick={
            editor.editing ? editor.handleEditSquareClick : canPlay ? onSquareClick : undefined
          }
          onDragMove={editor.editing || canPlay ? onDragMove : undefined}
          onDragHover={onDragHover}
          dragMark={dragFlag}
          onDrawArrow={canEdit && !editor.editing ? onDrawArrow : undefined}
          onToggleHighlight={canEdit && !editor.editing ? onToggleHighlight : undefined}
          drawColor={drawColor}
          onDrawColorChange={canEdit && !editor.editing ? onDrawColorChange : undefined}
          paintBrush={editor.editing ? editor.editBrush : null}
          onPaintSquare={
            editor.editing && editor.editBrush !== null ? editor.paintSquare : undefined
          }
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
                  ? 'border-brand-hi/60 bg-brand/20 text-ink'
                  : 'border-line bg-panel text-muted hover:bg-raised'
              }`}
              onClick={() => editor.toggleBrush('erase')}
            >
              ⌫
            </button>
          </div>
        )}
      </div>
      {editor.editing && (
        <div
          className="flex w-full max-w-[var(--board-size)] flex-col gap-2 rounded-control border border-line bg-panel p-3"
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
              onClick={onSetPosition}
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
      {/*
        One toolbar under the board (ADR-0031): the move navigation and the
        board actions share a single row — the rarer tools (position
        editing, drawing colors) live in the row's overflow menu. Hidden
        while the position editor owns the board (its toolbar has the
        exits).
      */}
      {!editor.editing && (
        <div
          className="flex w-full max-w-[calc(var(--board-size)+3.25rem)] flex-wrap items-center justify-center gap-x-3 gap-y-1.5"
          data-testid="board-toolbar"
        >
          <NavControls
            navTargets={navTargets}
            currentId={current.id}
            currentPly={current.ply}
            totalPly={tree.mainline_ply_count}
            onSelect={onSelect}
          />
          <BoardControls
            flipped={flipped}
            onFlip={onFlip}
            onOpenComment={canEdit ? onOpenComment : undefined}
            onToggleEdit={
              canEdit && onSetPosition !== undefined
                ? () =>
                    editor.editing
                      ? editor.exitEditMode()
                      : editor.enterEditMode(current.fen ?? null)
                : undefined
            }
            onFindExamples={canEdit ? onFindExamples : undefined}
            drawColorPicker={canEdit ? drawColorPicker : undefined}
            clearDrawings={canEdit ? clearDrawings : undefined}
          />
          {/* A terminal result rides the toolbar row (neutral ink), not a
              row of its own — every pixel of vertical chrome costs the
              board's height budget. */}
          {current.status !== 'active' && (
            <span id="analysis-status" className="text-ui font-semibold text-ink" role="status">
              {t(`analysis.status.${current.status}`)}
            </span>
          )}
        </div>
      )}
      {/*
        The annotation strip (v0): a fixed-height slot under the toolbar
        that always renders — the current move's comment when one exists
        (with an edit affordance), a quiet "comment on this move" ghost
        when empty. Reserving the height means a comment appearing or
        disappearing never shifts the board above it.
      */}
      {!editor.editing && (
        <div
          aria-live="polite"
          className={`flex h-11 w-full max-w-[var(--board-size)] items-start gap-2 overflow-hidden rounded-control px-2 py-1.5 transition-colors ${
            current.comment !== null ? 'bg-panel' : ''
          }`}
          data-testid="annotation-strip"
        >
          {current.comment !== null ? (
            <>
              <p className="line-clamp-2 flex-1 text-note leading-[1.125rem] text-muted">
                {current.comment}
              </p>
              {onOpenComment !== undefined && (
                <button
                  type="button"
                  aria-label={t('analysis.commentTitle')}
                  title={t('analysis.commentTitle')}
                  className="shrink-0 rounded-control px-1 text-faint transition-colors hover:text-ink"
                  onClick={onOpenComment}
                >
                  ✎
                </button>
              )}
            </>
          ) : (
            onOpenComment !== undefined && (
              <button
                type="button"
                className="flex h-full items-center gap-1.5 rounded-control px-1 text-note text-faint transition-colors hover:text-muted"
                onClick={onOpenComment}
                data-testid="comment-on-move"
              >
                💬 {t('analysis.commentOnMove')}
              </button>
            )
          )}
        </div>
      )}
      <p className="sr-only" role="status">
        {selected !== null ? t('analysis.selected', { square: selected }) : boardLabel}
      </p>
    </div>
  );
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
  // The tray color is theme-aware: a muted slate on dark, a soft gray on
  // light — quiet, but the solid-black pawn still reads on both. Pieces sit
  // on tiles the size of a board square. Left-aligned (the eraser floats
  // right of the bottom strip, so centering would overlap it).
  return (
    <div
      className="flex items-center justify-start gap-1 self-start rounded-control border border-line bg-tray px-2 py-1"
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
            className={`grid h-[min(calc(var(--board-size)/8),4.25rem)] w-[min(calc(var(--board-size)/8),4.25rem)] place-items-center rounded-control leading-none transition-colors ${
              active ? 'bg-brand/25 ring-1 ring-brand-hi/60' : 'hover:bg-black/10'
            }`}
            onPointerDown={(event) => editor.handlePalettePointerDown({ color, kind }, event)}
            onClick={() => editor.handlePaletteClick({ color, kind })}
          >
            <img
              src={pieceSrc({ color, kind })}
              alt=""
              draggable={false}
              className="h-[85%] w-[85%] select-none"
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
