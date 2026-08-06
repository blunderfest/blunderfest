import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';
import type { BackendStatus } from '@/app/App';
import { button, input, panel } from '@/components/ui';
import { generateRoomCode, normalizeRoomCode } from '@/lib/roomCode';

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
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
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
        <section className={panel({ width: 'sm', layout: 'stretch' })}>
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
            <label className="sr-only" htmlFor="join-code-input">
              {t('home.joinLabel')}
            </label>
            <input
              id="join-code-input"
              className={input()}
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
    </div>
  );
}
