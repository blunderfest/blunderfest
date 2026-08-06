import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';
import Board from '@/components/Board';
import { parseFen } from '@/components/board';
import { fetchLegalMoves, type GameNode, type GameTree, type LegalMove } from '@/lib/api';
import type { MoveAtPlyOp } from '@/protocol/ops';

const panel = tv({
  base: 'flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-6',
});

const button = tv({
  base: 'rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
  variants: {
    variant: {
      primary: 'bg-ink text-surface hover:bg-white',
      ghost: 'border border-white/10 text-ink hover:border-white/30',
    },
  },
});

const moveButton = tv({
  base: 'rounded-md px-1.5 py-0.5 font-mono text-sm transition-colors',
  variants: {
    selected: { true: 'bg-ink/20 text-white', false: 'text-ink hover:bg-white/10' },
    bold: { true: 'font-bold', false: '' },
  },
});

const moveNumber = (node: GameNode) =>
  `${Math.ceil(node.ply / 2)}${node.ply % 2 === 1 ? '.' : '…'}`;

type Row =
  | { type: 'pair'; white: GameNode; black: GameNode | null }
  | { type: 'variation'; root: GameNode };

function MoveButton({
  node,
  selected,
  bold,
  onSelect,
}: {
  node: GameNode;
  selected: boolean;
  bold?: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`analysis-move-${node.id}`}
      className={moveButton({ selected, bold: bold ?? false })}
      onClick={() => onSelect(node.id)}
    >
      <span className="text-muted">{moveNumber(node)}</span> {node.san}
    </button>
  );
}

function VariationLine({
  root,
  currentId,
  onSelect,
  nested = false,
}: {
  root: GameNode;
  currentId: number | null;
  onSelect: (id: number) => void;
  nested?: boolean;
}) {
  const nodes: GameNode[] = [];
  let node: GameNode | null = root;
  while (node) {
    nodes.push(node);
    node = node.children[0] ?? null;
  }

  const content = (
    <Fragment>
      <span className="text-muted">(</span>
      {nodes.map((node, index) => (
        <Fragment key={node.id}>
          <MoveButton
            node={node}
            selected={node.id === currentId}
            bold={index === 0}
            onSelect={onSelect}
          />
          {node.comment && <span className="text-xs italic text-muted">{node.comment}</span>}
          {node.children.slice(1).map((child) => (
            <VariationLine
              key={child.id}
              root={child}
              currentId={currentId}
              onSelect={onSelect}
              nested
            />
          ))}
        </Fragment>
      ))}
      <span className="text-muted">)</span>
    </Fragment>
  );

  if (nested) {
    return content;
  }
  return <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 pl-7">{content}</div>;
}

type Entry = { node: GameNode; parent: GameNode | null };

export default function Analysis({
  tree,
  presenterId = null,
  selfId = null,
  presenterCursorId = null,
  following = false,
  onFollowChange,
  onCursorChange,
  onPlayMove,
}: {
  tree: GameTree | null;
  presenterId?: string | null;
  selfId?: string | null;
  presenterCursorId?: number | null;
  following?: boolean;
  onFollowChange?: (following: boolean) => void;
  onCursorChange?: (nodeId: number) => void;
  onPlayMove?: (payload: Omit<MoveAtPlyOp['payload'], 'game_id'>) => void;
}) {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);
  const [legalMoves, setLegalMoves] = useState<LegalMove[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const presenterActive = presenterId !== null;
  const amPresenter = selfId !== null && selfId === presenterId;

  const byId = useMemo(() => {
    const map = new Map<number, Entry>();
    const walk = (node: GameNode, parent: GameNode | null) => {
      map.set(node.id, { node, parent });
      node.children.forEach((child) => {
        walk(child, node);
      });
    };
    if (tree) {
      walk(tree.root, null);
    }
    return map;
  }, [tree]);

  const [currentId, setCurrentId] = useState<number | null>(null);

  /**
   * Nodes the presenter played that have been broadcast but not yet applied
   * back through the echo. Rendered like regular nodes so the board can show
   * the move immediately; the replayed tree takes precedence once it arrives.
   */
  const [pending, setPending] = useState<Map<number, GameNode>>(new Map());

  const current: GameNode | null = useMemo(
    () =>
      currentId === null ? null : (byId.get(currentId)?.node ?? pending.get(currentId) ?? null),
    [currentId, byId, pending],
  );

  /**
   * Keep the cursor where it is while the tree is updated in place (moves,
   * variations); reset to the root when the tree is replaced wholesale and
   * the current node is gone (new game, replay of a different op log).
   */
  const prevTreeRef = useRef<GameTree | null>(null);

  useEffect(() => {
    const prev = prevTreeRef.current;
    prevTreeRef.current = tree;
    if (tree === null) {
      setCurrentId(null);
      setPending(new Map());
      return;
    }
    if (prev === tree) {
      return;
    }
    if (current === null) {
      setCurrentId(tree.root.id);
    }
  }, [tree, current]);

  const canPlay = amPresenter && current !== null && current.status === 'active';

  /**
   * Fetch legal moves for the position when the presenter can play, so the
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
   * Plays a legal move: the presenter broadcasts the op with all node data
   * and moves to the node every client will derive (max id + 1). The node is
   * kept in `pending` until the echo applies it to the tree.
   */
  const playMove = useCallback(
    (move: LegalMove) => {
      if (current === null || onPlayMove === undefined) {
        return;
      }
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
    [current, onPlayMove, maxNodeId],
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
   * Snap to the presenter's cursor while following.
   */
  useEffect(() => {
    if (following && presenterCursorId !== null && byId.has(presenterCursorId)) {
      setCurrentId(presenterCursorId);
    }
  }, [following, presenterCursorId, byId]);

  /**
   * Broadcast our own cursor when presenting.
   */
  useEffect(() => {
    if (amPresenter && currentId !== null && onCursorChange) {
      onCursorChange(currentId);
    }
  }, [amPresenter, currentId, onCursorChange]);

  const rows = useMemo(() => {
    if (!tree) {
      return [];
    }
    const result: Row[] = [];
    let node: GameNode | null = tree.root.children[0] ?? null;
    while (node) {
      const white: GameNode = node;
      const black: GameNode | null =
        white.children[0] && white.children[0].ply % 2 === 0 ? white.children[0] : null;
      result.push({ type: 'pair', white, black });
      white.children.slice(1).forEach((child) => {
        result.push({ type: 'variation', root: child });
      });
      if (black) {
        black.children.slice(1).forEach((child) => {
          result.push({ type: 'variation', root: child });
        });
      }
      node = black ? (black.children[0] ?? null) : (white.children[0] ?? null);
    }
    return result;
  }, [tree]);

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
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            id="analysis-first-button"
            className={button({ variant: 'ghost' })}
            disabled={parent === null}
            aria-keyshortcuts="Home"
            onClick={() => navigate(tree.root.id)}
          >
            ⏮ {t('analysis.first')}
          </button>
          <button
            type="button"
            id="analysis-prev-button"
            className={button({ variant: 'ghost' })}
            disabled={parent === null}
            aria-keyshortcuts="ArrowLeft"
            onClick={() => parent !== null && navigate(parent.id)}
          >
            ◀ {t('analysis.prev')}
          </button>
          <button
            type="button"
            id="analysis-next-button"
            className={button({ variant: 'ghost' })}
            disabled={next === null}
            aria-keyshortcuts="ArrowRight"
            onClick={() => next !== null && navigate(next.id)}
          >
            {t('analysis.next')} ▶
          </button>
          <button
            type="button"
            id="analysis-last-button"
            className={button({ variant: 'ghost' })}
            disabled={current.children.length === 0}
            aria-keyshortcuts="End"
            onClick={() => navigate(lastChild(current).id)}
          >
            {t('analysis.last')} ⏭
          </button>
          <button
            type="button"
            id="analysis-flip-button"
            className={button({ variant: 'ghost' })}
            aria-pressed={flipped}
            aria-keyshortcuts="f"
            onClick={() => setFlipped((f) => !f)}
          >
            {t('analysis.flip')}
          </button>
          {presenterActive && !amPresenter && (
            <button
              type="button"
              id="analysis-follow-button"
              className={button({ variant: 'ghost' })}
              aria-pressed={following}
              onClick={() => onFollowChange?.(!following)}
            >
              {following ? t('analysis.following') : t('analysis.follow')}
            </button>
          )}
          {amPresenter && (
            <p className="m-0 text-xs text-muted" role="status">
              {t('analysis.presenting')}
            </p>
          )}
        </div>
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

      <section className={panel()}>
        <h2 className="m-0 text-sm font-semibold text-muted">{t('analysis.moves')}</h2>
        <div id="analysis-move-list" className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {rows.map((row) =>
            row.type === 'pair' ? (
              <div key={row.white.id} className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                <MoveButton
                  node={row.white}
                  selected={row.white.id === current.id}
                  onSelect={navigate}
                />
                {row.white.comment && (
                  <span className="text-xs italic text-muted">{row.white.comment}</span>
                )}
                {row.black && (
                  <Fragment>
                    <MoveButton
                      node={row.black}
                      selected={row.black.id === current.id}
                      onSelect={navigate}
                    />
                    {row.black.comment && (
                      <span className="text-xs italic text-muted">{row.black.comment}</span>
                    )}
                  </Fragment>
                )}
              </div>
            ) : (
              <VariationLine
                key={row.root.id}
                root={row.root}
                currentId={current.id}
                onSelect={navigate}
              />
            ),
          )}
        </div>
      </section>

      <section className={panel()}>
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {tree.headers.Event && (
            <>
              <dt className="m-0 text-muted">{t('import.event')}</dt>
              <dd className="m-0 text-ink">{tree.headers.Event}</dd>
            </>
          )}
          {tree.headers.Date && (
            <>
              <dt className="m-0 text-muted">{t('import.date')}</dt>
              <dd className="m-0 text-ink">{tree.headers.Date}</dd>
            </>
          )}
          <dt className="m-0 text-muted">{t('import.plies')}</dt>
          <dd className="m-0 text-ink">{tree.mainline_ply_count}</dd>
          <dt className="m-0 text-muted">{t('import.variations')}</dt>
          <dd className="m-0 text-ink">{tree.node_count}</dd>
        </dl>
      </section>
    </div>
  );
}
