import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { tv } from 'tailwind-variants'
import type { GameNode, GameTree } from './api'
import Board from './Board'
import { parseFen } from './board'

const panel = tv({
  base: 'flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-6',
})

const button = tv({
  base: 'rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
  variants: {
    variant: {
      primary: 'bg-ink text-surface hover:bg-white',
      ghost: 'border border-white/10 text-ink hover:border-white/30',
    },
  },
})

const moveRow = tv({
  base: 'rounded-md px-2 py-1 font-mono text-sm text-ink transition-colors',
  variants: {
    selected: { true: 'bg-ink/20 text-white', false: 'hover:bg-white/10' },
  },
})

type Entry = { node: GameNode; parent: GameNode | null }

export default function Analysis({
  tree,
  onBack,
}: {
  tree: GameTree | null
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [flipped, setFlipped] = useState(false)

  const byId = useMemo(() => {
    const map = new Map<number, Entry>()
    const walk = (node: GameNode, parent: GameNode | null) => {
      map.set(node.id, { node, parent })
      node.children.forEach((child) => walk(child, node))
    }
    if (tree) walk(tree.root, null)
    return map
  }, [tree])

  const [currentId, setCurrentId] = useState<number | null>(null)

  useEffect(() => {
    setCurrentId(tree?.root.id ?? null)
  }, [tree])

  const current: GameNode | null = currentId === null ? null : byId.get(currentId)?.node ?? null

  const moveRows = useMemo(() => {
    const rows: { node: GameNode; depth: number }[] = []
    const walk = (node: GameNode, depth: number) => {
      rows.push({ node, depth })
      node.children.forEach((child) => walk(child, depth + 1))
    }
    if (tree) tree.root.children.forEach((child) => walk(child, 0))
    return rows
  }, [tree])

  useEffect(() => {
    if (!tree) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        setCurrentId((id) => id === null ? id : byId.get(id)?.node.children[0]?.id ?? id)
      }
      if (event.key === 'ArrowLeft') {
        setCurrentId((id) => id === null ? id : byId.get(id)?.parent?.id ?? id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tree, byId])

  if (tree === null || current === null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <p className="m-0 text-muted">{t('analysis.noGame')}</p>
        <button id="analysis-back-button" className={button({ variant: 'ghost' })} onClick={onBack}>
          {t('analysis.back')}
        </button>
      </main>
    )
  }

  const parent = byId.get(current.id)?.parent ?? null
  const next = current.children[0] ?? null
  const lastChild = (node: GameNode): GameNode => (node.children[0] ? lastChild(node.children[0]) : node)

  const moveNumber = (node: GameNode) => `${Math.ceil(node.ply / 2)}${node.ply % 2 === 1 ? '.' : '…'}`

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <button id="analysis-back-button" className={button({ variant: 'ghost' })} onClick={onBack}>
          {t('analysis.back')}
        </button>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="m-0 text-3xl tracking-[-0.03em]">
            {tree.headers['White'] ?? '?'} – {tree.headers['Black'] ?? '?'}
          </h1>
          <p className="m-0 text-muted">{tree.result}</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Board
          position={parseFen(current.fen ?? '')}
          lastMove={current.from ? { from: current.from, to: current.to ?? '' } : null}
          flipped={flipped}
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            id="analysis-first-button"
            className={button({ variant: 'ghost' })}
            disabled={parent === null}
            onClick={() => setCurrentId(tree.root.id)}
          >
            ⏮ {t('analysis.first')}
          </button>
          <button
            id="analysis-prev-button"
            className={button({ variant: 'ghost' })}
            disabled={parent === null}
            onClick={() => parent !== null && setCurrentId(parent.id)}
          >
            ◀ {t('analysis.prev')}
          </button>
          <button
            id="analysis-next-button"
            className={button({ variant: 'ghost' })}
            disabled={next === null}
            onClick={() => setCurrentId(next.id)}
          >
            {t('analysis.next')} ▶
          </button>
          <button
            id="analysis-last-button"
            className={button({ variant: 'ghost' })}
            disabled={current.children.length === 0}
            onClick={() => setCurrentId(lastChild(current).id)}
          >
            {t('analysis.last')} ⏭
          </button>
          <button
            id="analysis-flip-button"
            className={button({ variant: 'ghost' })}
            onClick={() => setFlipped((f) => !f)}
          >
            {t('analysis.flip')}
          </button>
        </div>
        {current.status !== 'active' && (
          <p id="analysis-status" className="m-0 text-sm font-semibold text-warn">
            {t(`analysis.status.${current.status}`)}
          </p>
        )}
      </div>

      <section className={panel()}>
        <h2 className="m-0 text-sm font-semibold text-muted">{t('analysis.moves')}</h2>
        <div id="analysis-move-list" className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {moveRows.map(({ node, depth }) => (
            <div
              key={node.id}
              className={moveRow({ selected: node.id === current.id })}
              style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
              data-testid={`analysis-move-${node.id}`}
            >
              <button
                className="text-left text-ink"
                onClick={() => setCurrentId(node.id)}
              >
                <span className="text-muted">{moveNumber(node)}</span> {node.san}
              </button>
              {node.comment && <p className="m-0 text-xs text-muted">{node.comment}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className={panel()}>
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {tree.headers['Event'] && (
            <>
              <dt className="m-0 text-muted">{t('import.event')}</dt>
              <dd className="m-0 text-ink">{tree.headers['Event']}</dd>
            </>
          )}
          {tree.headers['Date'] && (
            <>
              <dt className="m-0 text-muted">{t('import.date')}</dt>
              <dd className="m-0 text-ink">{tree.headers['Date']}</dd>
            </>
          )}
          <dt className="m-0 text-muted">{t('import.plies')}</dt>
          <dd className="m-0 text-ink">{tree.mainline_ply_count}</dd>
          <dt className="m-0 text-muted">{t('import.variations')}</dt>
          <dd className="m-0 text-ink">{tree.node_count}</dd>
        </dl>
      </section>
    </main>
  )
}
