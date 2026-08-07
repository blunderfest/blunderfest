import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackendStatus } from '@/app/App';
import Logo from '@/components/Logo';
import { button, chip, input, panel, statusDot } from '@/components/ui';
import { createRoom } from '@/lib/api';
import { generateRoomCode, normalizeRoomCode, validRoomCode } from '@/lib/roomCode';

const DISALLOWED = /[ilo01]/;

export default function Home({
  backend,
  userName,
  onJoin,
}: {
  backend: BackendStatus;
  userName: string | null;
  onJoin: (slug: string) => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);

  async function handleCreate() {
    if (creating) {
      return;
    }
    setCreating(true);
    setCreateError(false);
    try {
      const slug = generateRoomCode();
      await createRoom(slug);
      onJoin(slug);
    } catch {
      setCreateError(true);
      setCreating(false);
    }
  }

  function handleJoin() {
    const slug = normalizeRoomCode(code);
    if (!validRoomCode(slug)) {
      setError(true);
      return;
    }
    setError(false);
    onJoin(slug);
  }

  const normalized = normalizeRoomCode(code);
  const hasDisallowed = DISALLOWED.test(code.toLowerCase());

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="m-0">
          <span className="sr-only">{t('app.name')}</span>
          <span aria-hidden="true">
            <Logo size="lg" />
          </span>
        </h1>
        <p className="m-0 max-w-lg text-lead text-muted">{t('app.tagline')}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <span className={chip({ tone: 'neutral' })}>{t('home.featTree')}</span>
          <span className={chip({ tone: 'neutral' })}>{t('home.featComments')}</span>
          <span className={chip({ tone: 'neutral' })}>{t('home.featEngine')}</span>
        </div>
      </div>

      <div className="flex w-full max-w-3xl flex-col items-stretch gap-4 md:flex-row">
        <section className={`${panel({ layout: 'stretch', pad: 'lg' })} flex-1`}>
          <h2 className="m-0 text-lead font-semibold">{t('home.createTitle')}</h2>
          <p className="m-0 text-ui text-muted">{t('home.createText')}</p>
          <button
            type="button"
            id="create-room-button"
            className={button({ intent: 'primary', size: 'lg', block: true })}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? t('home.creating') : t('home.create')}
          </button>
          <p className="m-0 text-center text-note text-faint">{t('home.noAccount')}</p>
          {createError && (
            <p className="m-0 text-ui text-bad-hi" role="alert">
              ⚠ {t('home.createError')}
            </p>
          )}
        </section>

        <section className={`${panel({ layout: 'stretch', pad: 'lg' })} flex-1`}>
          <h2 className="m-0 text-lead font-semibold">{t('home.joinTitle')}</h2>
          <p className="m-0 text-ui text-muted">{t('home.joinText')}</p>
          <div>
            <label className="sr-only" htmlFor="join-code-input">
              {t('home.joinLabel')}
            </label>
            <input
              id="join-code-input"
              className={input({ mono: true, invalid: error })}
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
            <p className="m-0 mt-1 text-right text-note text-faint tabular-nums">
              {t('home.charCount', { count: Math.min(normalized.length, 5) })}
            </p>
          </div>
          <button
            type="button"
            id="join-room-button"
            className={button({ intent: 'secondary', size: 'lg', block: true })}
            onClick={handleJoin}
          >
            {t('home.joinButton')}
          </button>
          {error && (
            <p className="m-0 text-ui text-bad-hi" role="alert">
              ⚠ {hasDisallowed ? t('home.joinErrorChars') : t('home.joinError')}
            </p>
          )}
        </section>
      </div>

      <p className="m-0 flex items-center gap-2 text-ui text-faint">
        {userName !== null && (
          <>
            {t('home.youAre', { name: userName })} · {t('home.anonymous')} ·
          </>
        )}
        <span
          className={statusDot({
            tone: backend === 'ok' ? 'ok' : backend === 'down' ? 'bad' : 'warn',
            pulse: backend === 'checking',
          })}
        />
        <span data-status={backend}>{t(`status.${backend}`)}</span>
      </p>

      <button
        type="button"
        id="demo-room-link"
        className={button({ intent: 'quiet', size: 'sm' })}
        onClick={() => onJoin('chess')}
      >
        {t('home.demoLink')}
      </button>
    </div>
  );
}
