import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfile } from '@/lib/useProfile'
import Home from '@/features/home/Home'
import RoomView from '@/features/room/RoomView'

export type BackendStatus = 'checking' | 'ok' | 'down'

type Route = { screen: 'home' } | { screen: 'room'; slug: string }

function readHashRoute(): Route {
  const match = window.location.hash.match(/^#\/r\/([a-z0-9]+)$/)
  if (match) return { screen: 'room', slug: match[1] }
  return { screen: 'home' }
}

function navigateToRoom(slug: string) {
  window.location.hash = `#/r/${slug}`
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
        <Home backend={backend} onJoin={navigateToRoom} />
      ) : (
        <RoomView slug={route.slug} onLeave={navigateHome} />
      )}
    </div>
  )
}
