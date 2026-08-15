import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';

import BookExitIcon from '@/features/analysis/BookExitIcon';
import { evalText, moveMark } from '@/features/analysis/evalMarks';
import type { Row } from '@/features/analysis/moveList';
import type { GameNode } from '@/lib/api';
import type { AnalysisEval } from '@/protocol/ops';

const moveButton = tv({
  base: 'rounded-control px-1.5 py-0.5 font-mono transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-hi',
  variants: {
    selected: {
      true: 'bg-gold/20 text-gold-hi ring-1 ring-gold/50 hover:bg-gold/25',
      false: '',
    },
    line: {
      main: 'text-ui font-semibold text-ink hover:bg-raised',
      variation: 'text-note font-normal text-muted hover:bg-raised hover:text-ink',
    },
  },
});

const moveNumber = (node: GameNode) =>
  `${Math.ceil(node.ply / 2)}${node.ply % 2 === 1 ? '.' : '...'}`;

function CommentDot() {
  const { t } = useTranslation();
  return (
    <span
      role="img"
      aria-label={t('analysis.hasComment')}
      className="ml-0.5 inline-block h-[9px] w-[9px] rounded-full bg-info align-middle"
    />
  );
}

function MoveButton({
  node,
  selected,
  line,
  showNumber,
  tabIndex,
  onSelect,
  onFocusMove,
  evaluation,
  before,
  bookExit = false,
  bestMove,
}: {
  node: GameNode;
  selected: boolean;
  line: 'main' | 'variation';
  showNumber: boolean;
  tabIndex: 0 | -1;
  onSelect: (id: number) => void;
  onFocusMove: (id: number) => void;
  /** The eval after this move, when an analysis exists. */
  evaluation?: AnalysisEval;
  /** The eval before this move (for the quality mark). */
  before?: AnalysisEval;
  /** This move left the opening book (mainline only). */
  bookExit?: boolean;
  /** The engine's best alternative (shown when the move is marked). */
  bestMove?: string;
}) {
  const { t } = useTranslation();
  const isSetup = node.san === null;
  const mark =
    evaluation !== undefined && before !== undefined
      ? moveMark(before.score, evaluation.score, node.ply % 2 === 1)
      : null;
  const markClass = mark === '??' ? 'text-bad-hi' : mark === '?' ? 'text-gold-hi' : 'text-muted';
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      data-testid={`analysis-move-${node.id}`}
      data-move-id={node.id}
      aria-current={selected ? 'true' : undefined}
      tabIndex={tabIndex}
      className={moveButton({ selected, line })}
      onClick={() => onSelect(node.id)}
      onFocus={() => onFocusMove(node.id)}
    >
      {isSetup ? (
        <em className="text-muted">⚙ {t('analysis.setupNode')}</em>
      ) : (
        <>
          {showNumber && <span className="text-faint">{moveNumber(node)}</span>} {node.san}
          {bookExit && (
            <span
              className="ml-0.5 inline-flex align-middle"
              title={t('analysis.bookExit')}
              data-testid="book-exit"
            >
              <BookExitIcon className="h-3 w-3 text-info" />
              <span className="sr-only">{t('analysis.bookExit')}</span>
            </span>
          )}
          {mark !== null && (
            <span
              className={`font-bold ${markClass}`}
              title={
                bestMove !== undefined ? t('analysis.bestMove', { move: bestMove }) : undefined
              }
            >
              {mark}
            </span>
          )}
          {evaluation !== undefined && (
            <span className="ml-0.5 text-micro text-faint tabular-nums">
              {evalText(evaluation.score)}
            </span>
          )}
          {node.comment !== null && <CommentDot />}
        </>
      )}
    </button>
  );
}

function VariationLine({
  root,
  currentId,
  activeOptionId,
  onFocusMove,
  onSelect,
  nested = false,
}: {
  root: GameNode;
  currentId: number | null;
  activeOptionId: number | null;
  onFocusMove: (id: number) => void;
  onSelect: (id: number) => void;
  nested?: boolean;
}) {
  const nodes: GameNode[] = [];
  let node: GameNode | null = root;
  while (node) {
    nodes.push(node);
    node = node.children[0] ?? null;
  }

  /**
   * Move-number rules: white moves always carry their number; black moves
   * only when the line starts with black (a black-to-move variation) or when
   * the line resumes after a nested variation has interrupted it.
   */
  let interrupted = true;
  const content = (
    <Fragment>
      <span className="text-faint">(</span>
      {nodes.map((node) => {
        const showNumber = node.ply % 2 === 1 || interrupted;
        const nestedVariations = node.children.slice(1);
        // A nested variation or a setup node breaks the flow — the next
        // black move gets its number restated.
        interrupted = nestedVariations.length > 0 || node.san === null;
        return (
          <Fragment key={node.id}>
            <MoveButton
              node={node}
              selected={node.id === currentId}
              line="variation"
              showNumber={showNumber}
              tabIndex={node.id === activeOptionId ? 0 : -1}
              onSelect={onSelect}
              onFocusMove={onFocusMove}
            />
            {node.comment !== null && (
              <span className="text-note italic text-muted">{node.comment}</span>
            )}
            {nestedVariations.map((child) => (
              <VariationLine
                key={child.id}
                root={child}
                currentId={currentId}
                activeOptionId={activeOptionId}
                onFocusMove={onFocusMove}
                onSelect={onSelect}
                nested
              />
            ))}
          </Fragment>
        );
      })}
      <span className="text-faint">)</span>
    </Fragment>
  );

  if (nested) {
    return content;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 border-l-2 border-line-strong pl-2">
      {content}
    </div>
  );
}

export default function MoveList({
  rows,
  currentId,
  onSelect,
  evalsByPly,
  bookExitPly = null,
  bestMoves,
}: {
  rows: Row[];
  currentId: number | null;
  onSelect: (id: number) => void;
  /** Mainline evals by ply, when a whole-game analysis exists (ADR-0009). */
  evalsByPly?: Record<number, AnalysisEval>;
  /** The mainline ply where the game leaves the opening book. */
  bookExitPly?: number | null;
  /** The engine's best alternative per ply, when an analysis exists. */
  bestMoves?: Map<number, string>;
}) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [listFocusId, setListFocusId] = useState<number | null>(null);

  const firstMoveId = useMemo(() => {
    for (const row of rows) {
      return row.type === 'pair' ? row.white.id : row.root.id;
    }
    return null;
  }, [rows]);

  /**
   * One tab stop for the whole list (WAI-ARIA listbox): the option with the
   * tab stop is the internal roving focus if set, else the current move,
   * else the first move.
   */
  const activeOptionId = listFocusId ?? currentId ?? firstMoveId;

  // Keep the current move visible while navigating; at the root (no move is
  // current) scroll back to the beginning of the list. (jsdom has no
  // scrollIntoView/scrollTo, hence the optional calls.)
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentId is the trigger, not a referenced value
  useEffect(() => {
    const current = listRef.current?.querySelector('[aria-current="true"]');
    if (current !== undefined && current !== null) {
      current.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    } else {
      listRef.current?.scrollTo?.({ top: 0 });
    }
    setListFocusId(null);
  }, [currentId]);

  function handleListKeyDown(event: React.KeyboardEvent) {
    if (listRef.current === null || activeOptionId === null) {
      return;
    }
    const buttons = Array.from(listRef.current.querySelectorAll<HTMLElement>('[data-move-id]'));
    if (buttons.length === 0) {
      return;
    }
    const activeIndex = Math.max(
      0,
      buttons.findIndex((button) => Number(button.dataset.moveId) === activeOptionId),
    );

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const nextIndex =
        event.key === 'ArrowDown'
          ? Math.min(activeIndex + 1, buttons.length - 1)
          : Math.max(activeIndex - 1, 0);
      const nextId = Number(buttons[nextIndex].dataset.moveId);
      setListFocusId(nextId);
      buttons[nextIndex].focus();
      buttons[nextIndex].scrollIntoView?.({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onSelect(activeOptionId);
    }
  }

  return (
    <section className="flex min-h-0 flex-col border-t border-line xl:flex-1">
      <div
        ref={listRef}
        id="analysis-move-list"
        role="listbox"
        aria-label={t('analysis.moves')}
        className="flex max-h-72 flex-col gap-1 overflow-y-auto p-2 xl:max-h-none xl:min-h-0 xl:flex-1"
        onKeyDown={handleListKeyDown}
      >
        {rows.map((row) =>
          row.type === 'pair' ? (
            <div key={row.white.id} className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
              <MoveButton
                node={row.white}
                selected={row.white.id === currentId}
                line="main"
                showNumber
                tabIndex={row.white.id === activeOptionId ? 0 : -1}
                onSelect={onSelect}
                onFocusMove={setListFocusId}
                evaluation={evalsByPly?.[row.white.ply]}
                before={evalsByPly?.[row.white.ply - 1]}
                bookExit={bookExitPly === row.white.ply}
                bestMove={bestMoves?.get(row.white.ply)}
              />
              {row.white.comment && (
                <div className="basis-full border-l-2 border-line-strong pl-2 text-note italic text-muted">
                  {row.white.comment}
                </div>
              )}
              {row.black && (
                <MoveButton
                  node={row.black}
                  selected={row.black.id === currentId}
                  line="main"
                  showNumber={false}
                  tabIndex={row.black.id === activeOptionId ? 0 : -1}
                  onSelect={onSelect}
                  onFocusMove={setListFocusId}
                  evaluation={evalsByPly?.[row.black.ply]}
                  before={evalsByPly?.[row.black.ply - 1]}
                  bookExit={bookExitPly === row.black.ply}
                  bestMove={bestMoves?.get(row.black.ply)}
                />
              )}
              {row.black?.comment && (
                <div className="basis-full border-l-2 border-line-strong pl-2 text-note italic text-muted">
                  {row.black.comment}
                </div>
              )}
            </div>
          ) : (
            <VariationLine
              key={row.root.id}
              root={row.root}
              currentId={currentId}
              activeOptionId={activeOptionId}
              onFocusMove={setListFocusId}
              onSelect={onSelect}
            />
          ),
        )}
      </div>
    </section>
  );
}
