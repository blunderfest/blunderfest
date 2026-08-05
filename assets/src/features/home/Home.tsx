import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';
import type { BackendStatus } from '@/app/App';
import { generateRoomCode, normalizeRoomCode } from '@/lib/roomCode';

const panel = tv({
  base: 'flex w-full max-w-sm flex-col items-stretch gap-3 rounded-xl border border-white/10 bg-white/5 p-6',
});

const button = tv({
  base: 'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
  variants: {
    variant: {
      primary: 'bg-ink text-surface hover:bg-white',
      ghost: 'border border-white/10 text-ink hover:border-white/30',
    },
  },
});

export default function Home({
  backend,
  onJoin,
}: {
  backend: BackendStatus;
  onJoin: (slug: string) => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);

  function handleCreate() {
    if (creating) {
      return;
    }
    setCreating(true);
    onJoin(generateRoomCode());
  }

  function handleJoin() {
    const slug = normalizeRoomCode(code);
    if (!slug) {
      setError(true);
      return;
    }
    setError(false);
    onJoin(slug);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="m-0 text-5xl tracking-[-0.03em]">{t('app.name')}</h1>
        <p className="m-0 text-muted">{t('app.tagline')}</p>
        <p
          className={tv({
            base: 'm-0 text-sm',
            variants: { status: { checking: 'text-warn', ok: 'text-ok', down: 'text-bad' } },
          })({ status: backend })}
          data-status={backend}
        >
          {t(`status.${backend}`)}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <section className={panel()}>
          <button
            type="button"
            id="create-room-button"
            className={button({ variant: 'primary' })}
            onClick={handleCreate}
          >
            {t('home.create')}
          </button>
          <p className="m-0 text-center text-sm text-muted">{t('home.createHint')}</p>
        </section>

        <section className={panel()}>
          <h2 className="m-0 text-sm font-semibold text-muted">{t('home.join')}</h2>
          <div className="flex gap-2">
            <input
              id="join-code-input"
              className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-white/40 focus:outline-none"
              placeholder={t('home.joinPlaceholder')}
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleJoin();
                }
              }}
            />
            <button
              type="button"
              id="join-room-button"
              className={button({ variant: 'ghost' })}
              onClick={handleJoin}
            >
              {t('home.joinButton')}
            </button>
          </div>
          {error && (
            <p className="m-0 text-sm text-bad" role="alert">
              {t('home.joinError')}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
