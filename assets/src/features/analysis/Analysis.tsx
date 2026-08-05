import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';
import Board from '@/components/Board';
import { parseFen } from '@/components/board';
import type { GameNode, GameTree } from '@/lib/api';

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

export default function Analysis({ tree }: { tree: GameTree | null }) {
  const { t } = useTranslation();
  const [flipped, setFlipped] = useState(false);

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

  useEffect(() => {
    setCurrentId(tree?.root.id ?? null);
  }, [tree]);

  const current: GameNode | null = currentId === null ? null : (byId.get(currentId)?.node ?? null);

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

  useEffect(() => {
    if (!tree) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      let handled = false;
      if (event.key === 'ArrowRight') {
        setCurrentId((id) => (id === null ? id : (byId.get(id)?.node.children[0]?.id ?? id)));
        handled = true;
      }
      if (event.key === 'ArrowLeft') {
        setCurrentId((id) => (id === null ? id : (byId.get(id)?.parent?.id ?? id)));
        handled = true;
      }
      if (event.key === 'Home') {
        setCurrentId(tree.root.id);
        handled = true;
      }
      if (event.key === 'End') {
        setCurrentId((id) => {
          const start = id === null ? tree.root : (byId.get(id)?.node ?? tree.root);
          let node = start;
          while (node.children[0]) {
            node = node.children[0];
          }
          return node.id;
        });
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
  }, [tree, byId]);

  if (tree === null || current === null) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 p-8">
        <p className="m-0 text-muted">{t('analysis.noGame')}</p>
      </div>
    );
  }

  const parent = byId.get(current.id)?.parent ?? null;
  const next = current.children[0] ?? null;
  const lastChild = (node: GameNode): GameNode =>
    node.children[0] ? lastChild(node.children[0]) : node;

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
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            id="analysis-first-button"
            className={button({ variant: 'ghost' })}
            disabled={parent === null}
            aria-keyshortcuts="Home"
            onClick={() => setCurrentId(tree.root.id)}
          >
            ⏮ {t('analysis.first')}
          </button>
          <button
            type="button"
            id="analysis-prev-button"
            className={button({ variant: 'ghost' })}
            disabled={parent === null}
            aria-keyshortcuts="ArrowLeft"
            onClick={() => parent !== null && setCurrentId(parent.id)}
          >
            ◀ {t('analysis.prev')}
          </button>
          <button
            type="button"
            id="analysis-next-button"
            className={button({ variant: 'ghost' })}
            disabled={next === null}
            aria-keyshortcuts="ArrowRight"
            onClick={() => setCurrentId(next.id)}
          >
            {t('analysis.next')} ▶
          </button>
          <button
            type="button"
            id="analysis-last-button"
            className={button({ variant: 'ghost' })}
            disabled={current.children.length === 0}
            aria-keyshortcuts="End"
            onClick={() => setCurrentId(lastChild(current).id)}
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
                  onSelect={setCurrentId}
                />
                {row.white.comment && (
                  <span className="text-xs italic text-muted">{row.white.comment}</span>
                )}
                {row.black && (
                  <Fragment>
                    <MoveButton
                      node={row.black}
                      selected={row.black.id === current.id}
                      onSelect={setCurrentId}
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
                onSelect={setCurrentId}
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
