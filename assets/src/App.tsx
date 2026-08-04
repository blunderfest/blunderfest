import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfile } from './useProfile'

type BackendStatus = 'checking' | 'ok' | 'down'

export default function App() {
  const { t } = useTranslation()
  const [backend, setBackend] = useState<BackendStatus>('checking')
  const profile = useProfile()

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/healthz', { signal: controller.signal })
      .then((response) => setBackend(response.ok ? 'ok' : 'down'))
      .catch(() => setBackend('down'))

    return () => controller.abort()
  }, [])

  return (
    <main className="app">
      <h1 className="app__title">{t('app.name')}</h1>
      <p className="app__tagline">{t('app.tagline')}</p>
      <p className="app__status" data-status={backend}>
        {t(`status.${backend}`)}
      </p>
      <p className="app__identity" data-status={profile.status}>
        {profile.status === 'ready'
          ? t('profile.name', { name: profile.profile.name })
          : profile.status === 'error'
            ? t('profile.error')
            : t('profile.loading')}
      </p>
    </main>
  )
}