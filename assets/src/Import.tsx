import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { tv } from 'tailwind-variants'
import { ApiError, importLichess, importPgn, type GameNode, type GameTree } from './api'
const panel = tv({
  base: 'flex w-full max-w-xl flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-6',
})

const button = tv({
  base: 'rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  variants: {
    variant: {
      primary: 'bg-ink text-surface hover:bg-white',
      ghost: 'border border-white/10 text-ink hover:border-white/30',
    },
  },
})

function mainline(tree: GameTree): GameNode[] {
  const line: GameNode[] = []
  let node = tree.root
  while (node.children.length > 0) {
    node = node.children[0]
    line.push(node)
  }
  return line
}

type ImportState =
  | { status: 'idle' }
  | { status: 'importing' }
  | { status: 'success'; tree: GameTree }
  | { status: 'error'; code: string }

export default function Import({
  onBack,
  onAnalyze,
}: {
  onBack: () => void
  onAnalyze: (tree: GameTree) => void
}) {
  const { t } = useTranslation()
  const [pgn, setPgn] = useState('')
  const [url, setUrl] = useState('')
  const [state, setState] = useState<ImportState>({ status: 'idle' })

  function handleImport() {
    if (state.status === 'importing') return
    if (!pgn.trim() && !url.trim()) return

    setState({ status: 'importing' })

    const request = url.trim() ? importLichess(url.trim()) : importPgn(pgn)
    request.then(
      ({ tree }) => setState({ status: 'success', tree }),
      (error) =>
        setState({ status: 'error', code: error instanceof ApiError ? error.code : 'unknown' }),
    )
  }

  const line = state.status === 'success' ? mainline(state.tree) : []

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="flex w-full max-w-xl flex-col gap-2">
        <button id="import-back-button" className={button({ variant: 'ghost' })} onClick={onBack}>
          {t('import.back')}
        </button>
        <h1 className="m-0 text-3xl tracking-[-0.03em]">{t('import.title')}</h1>
        <p className="m-0 text-muted">{t('import.subtitle')}</p>
      </div>

      <section className={panel()}>
        <label className="m-0 text-sm font-semibold text-muted" htmlFor="pgn-input">
          {t('import.pgnLabel')}
        </label>
        <textarea
          id="pgn-input"
          className="h-40 w-full resize-y rounded-lg border border-white/10 bg-transparent px-3 py-2 font-mono text-xs text-ink placeholder:text-muted focus:border-white/40 focus:outline-none"
          placeholder={t('import.pgnPlaceholder')}
          value={pgn}
          onChange={(event) => setPgn(event.target.value)}
        />
        <label className="m-0 text-sm font-semibold text-muted" htmlFor="lichess-url-input">
          {t('import.lichessLabel')}
        </label>
        <input
          id="lichess-url-input"
          className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-white/40 focus:outline-none"
          placeholder={t('import.lichessPlaceholder')}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleImport()
          }}
        />
        <button
          id="import-submit-button"
          className={button({ variant: 'primary' })}
          disabled={state.status === 'importing' || (!pgn.trim() && !url.trim())}
          onClick={handleImport}
        >
          {t('import.submit')}
        </button>
        {state.status === 'error' && (
          <p className="m-0 text-sm text-bad">{t(`import.errors.${state.code}`)}</p>
        )}
      </section>

      {state.status === 'success' && (
        <section className={panel()}>
          <button
            id="analyze-button"
            className={button({ variant: 'primary' })}
            onClick={() => onAnalyze(state.tree)}
          >
            {t('import.analyze')}
          </button>
          <h2 className="m-0 text-sm font-semibold text-muted">{t('import.summary')}</h2>
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {state.tree.headers['White'] && (
              <>
                <dt className="m-0 text-muted">{t('import.white')}</dt>
                <dd className="m-0 text-ink">{state.tree.headers['White']}</dd>
              </>
            )}
            {state.tree.headers['Black'] && (
              <>
                <dt className="m-0 text-muted">{t('import.black')}</dt>
                <dd className="m-0 text-ink">{state.tree.headers['Black']}</dd>
              </>
            )}
            {state.tree.headers['Event'] && (
              <>
                <dt className="m-0 text-muted">{t('import.event')}</dt>
                <dd className="m-0 text-ink">{state.tree.headers['Event']}</dd>
              </>
            )}
            <dt className="m-0 text-muted">{t('import.result')}</dt>
            <dd className="m-0 text-ink">{state.tree.result}</dd>
            <dt className="m-0 text-muted">{t('import.plies')}</dt>
            <dd className="m-0 text-ink">{state.tree.mainline_ply_count}</dd>
            <dt className="m-0 text-muted">{t('import.variations')}</dt>
            <dd className="m-0 text-ink">{state.tree.node_count}</dd>
          </dl>
          <p
            id="import-mainline"
            className="m-0 break-words font-mono text-sm leading-relaxed text-ink"
          >
            {line.map((node) => `${node.ply}. ${node.san}`).join(' ')}
          </p>
        </section>
      )}
    </main>
  )
}
