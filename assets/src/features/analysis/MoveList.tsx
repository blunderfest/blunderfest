import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';
import { panel } from '@/components/ui';
import type { Row } from '@/features/analysis/moveList';
import type { GameNode } from '@/lib/api';

const moveButton = tv({
  base: 'rounded-md px-1.5 py-0.5 font-mono text-sm transition-colors',
  variants: {
    selected: { true: 'bg-ink/20 text-white', false: 'text-ink hover:bg-white/10' },
    bold: { true: 'font-bold', false: '' },
  },
});

const moveNumber = (node: GameNode) =>
  `${Math.ceil(node.ply / 2)}${node.ply % 2 === 1 ? '.' : '...'}`;

function MoveButton({
  node,
  selected,
  bold,
  showNumber,
  onSelect,
}: {
  node: GameNode;
  selected: boolean;
  bold?: boolean;
  showNumber: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`analysis-move-${node.id}`}
      aria-current={selected ? 'true' : undefined}
      className={moveButton({ selected, bold: bold ?? false })}
      onClick={() => onSelect(node.id)}
    >
      {showNumber && <span className="text-muted">{moveNumber(node)}</span>} {node.san}
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

  /**
   * Move-number rules: white moves always carry their number; black moves
   * only when the line starts with black (a black-to-move variation) or when
   * the line resumes after a nested variation has interrupted it.
   */
  let interrupted = true;
  const content = (
    <Fragment>
      <span className="text-muted">(</span>
      {nodes.map((node) => {
        const showNumber = node.ply % 2 === 1 || interrupted;
        const nested = node.children.slice(1);
        interrupted = nested.length > 0;
        return (
          <Fragment key={node.id}>
            <MoveButton
              node={node}
              selected={node.id === currentId}
              bold={node.id === root.id}
              showNumber={showNumber}
              onSelect={onSelect}
            />
            {node.comment && <span className="text-xs italic text-muted">{node.comment}</span>}
            {nested.map((child) => (
              <VariationLine
                key={child.id}
                root={child}
                currentId={currentId}
                onSelect={onSelect}
                nested
              />
            ))}
          </Fragment>
        );
      })}
      <span className="text-muted">)</span>
    </Fragment>
  );

  if (nested) {
    return content;
  }
  return <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 pl-7">{content}</div>;
}

export default function MoveList({
  rows,
  currentId,
  onSelect,
}: {
  rows: Row[];
  currentId: number | null;
  onSelect: (id: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className={`${panel()} min-h-0 xl:flex-1`}>
      <h2 className="m-0 text-sm font-semibold text-muted">{t('analysis.moves')}</h2>
      <div
        id="analysis-move-list"
        className="flex max-h-72 flex-col gap-0.5 overflow-y-auto xl:max-h-none xl:min-h-0 xl:flex-1"
      >
        {rows.map((row) =>
          row.type === 'pair' ? (
            <div key={row.white.id} className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
              <MoveButton
                node={row.white}
                selected={row.white.id === currentId}
                showNumber
                onSelect={onSelect}
              />
              {row.white.comment && (
                <span className="text-xs italic text-muted">{row.white.comment}</span>
              )}
              {row.black && (
                <Fragment>
                  <MoveButton
                    node={row.black}
                    selected={row.black.id === currentId}
                    showNumber={false}
                    onSelect={onSelect}
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
              currentId={currentId}
              onSelect={onSelect}
            />
          ),
        )}
      </div>
    </section>
  );
}
