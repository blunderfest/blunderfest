import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type BackendStatus = 'checking' | 'ok' | 'down'

export default function App() {
  const { t } = useTranslation()
  const [backend, setBackend] = useState<BackendStatus>('checking')

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
    </main>
  )
}