import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { tv } from 'tailwind-variants'
import { useProfile } from './useProfile'

type BackendStatus = 'checking' | 'ok' | 'down'

const statusStyles = tv({
  base: 'm-0',
  variants: {
    status: {
      checking: 'text-warn',
      ok: 'text-ok',
      down: 'text-bad',
    },
  },
})

const identityStyles = tv({
  base: 'm-0',
  variants: {
    status: {
      loading: 'text-muted',
      ready: 'text-ink',
      error: 'text-bad',
    },
  },
})

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <h1 className="m-0 text-5xl tracking-[-0.03em]">{t('app.name')}</h1>
      <p className="m-0 text-muted">{t('app.tagline')}</p>
      <p className={statusStyles({ status: backend })} data-status={backend}>
        {t(`status.${backend}`)}
      </p>
      <p className={identityStyles({ status: profile.status })} data-status={profile.status}>
        {profile.status === 'ready'
          ? t('profile.name', { name: profile.profile.name })
          : profile.status === 'error'
            ? t('profile.error')
            : t('profile.loading')}
      </p>
    </main>
  )
}
