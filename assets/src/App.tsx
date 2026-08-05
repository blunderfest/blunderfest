import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfile } from './useProfile'
import { getTree, setTree } from './analysisStore'
import Home from './Home'
import Import from './Import'
import Analysis from './Analysis'
import RoomView from './RoomView'
import type { GameTree } from './api'

export type BackendStatus = 'checking' | 'ok' | 'down'

type Route =
  | { screen: 'home' }
  | { screen: 'import' }
  | { screen: 'analysis' }
  | { screen: 'room'; slug: string }

function readHashRoute(): Route {
  if (window.location.hash === '#/import') return { screen: 'import' }
  if (window.location.hash === '#/analysis') return { screen: 'analysis' }
  const match = window.location.hash.match(/^#\/r\/([a-z0-9]+)$/)
  if (match) return { screen: 'room', slug: match[1] }
  return { screen: 'home' }
}

function navigateToRoom(slug: string) {
  window.location.hash = `#/r/${slug}`
}

function navigateImport() {
  window.location.hash = '#/import'
}

function navigateToAnalysis(tree: GameTree) {
  setTree(tree)
  window.location.hash = '#/analysis'
}

function navigateHome() {
  window.location.hash = '#/'
}

export default function App() {
  const { t } = useTranslation()
  const [backend, setBackend] = useState<BackendStatus>('checking')
  const [route, setRoute] = useState<Route>(readHashRoute)
  const profile = useProfile()

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/healthz', { signal: controller.signal })
      .then((response) => setBackend(response.ok ? 'ok' : 'down'))
      .catch(() => setBackend('down'))

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const onHashChange = () => setRoute(readHashRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const name =
    profile.status === 'ready'
      ? profile.profile.name
      : profile.status === 'error'
        ? t('profile.error')
        : t('profile.loading')

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-3">
        <a
          href="#/"
          className="text-sm font-semibold tracking-[-0.01em] text-ink no-underline"
        >
          {t('app.name')}
        </a>
        <p className="m-0 text-sm text-muted" data-status={profile.status}>
          {name}
        </p>
      </header>

      {route.screen === 'home' ? (
        <Home backend={backend} onJoin={navigateToRoom} onImport={navigateImport} />
      ) : route.screen === 'import' ? (
        <Import onBack={navigateHome} onAnalyze={navigateToAnalysis} />
      ) : route.screen === 'analysis' ? (
        <Analysis tree={getTree()} onBack={navigateHome} />
      ) : (
        <RoomView slug={route.slug} onLeave={navigateHome} />
      )}
    </div>
  )
}
