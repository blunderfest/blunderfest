import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackendStatus } from '@/app/App';
import Logo from '@/components/Logo';
import { button, input, listRow, panel, panelHeader, statusDot } from '@/components/ui';
import {
  ApiError,
  createRoom,
  deleteFromLibrary,
  fetchLibrary,
  type GameTree,
  type LibraryEntry,
} from '@/lib/api';
import { loadDevice } from '@/lib/device';
import { formatRegion } from '@/lib/region';
import {
  generateRoomCode,
  normalizeRoomCode,
  ROOM_ALPHABET,
  ROOM_CODE_LENGTH,
  validRoomCode,
} from '@/lib/roomCode';

/** Keep only alphabet characters, lowercased, capped at the code length. */
function filterCodeInput(value: string): string {
  return value
    .toLowerCase()
    .split('')
    .filter((char) => ROOM_ALPHABET.includes(char))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);
}

export default function Home({
  backend,
  region = null,
  userName,
  onJoin,
  onOpenGame,
}: {
  backend: BackendStatus;
  region?: string | null;
  userName: string | null;
  onJoin: (slug: string) => void;
  onOpenGame?: (tree: GameTree, slug: string) => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<'generic' | 'rate_limited' | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);

  useEffect(() => {
    const device = loadDevice();
    if (userName === null || device === null) {
      return;
    }
    let cancelled = false;
    fetchLibrary(device)
      .then((entries) => {
        if (!cancelled) {
          setLibrary(entries);
        }
      })
      .catch(() => {
        // A missing/expired library is indistinguishable from an empty one.
      });
    return () => {
      cancelled = true;
    };
  }, [userName]);

  async function handleCreate() {
    if (creating) {
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const slug = generateRoomCode();
      await createRoom(slug);
      onJoin(slug);
    } catch (error) {
      setCreateError(
        error instanceof ApiError && error.code === 'rate_limited' ? 'rate_limited' : 'generic',
      );
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

  async function handleOpenGame(entry: LibraryEntry) {
    if (creating) {
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const slug = generateRoomCode();
      await createRoom(slug);
      onOpenGame?.(entry.tree, slug);
    } catch (error) {
      setCreateError(
        error instanceof ApiError && error.code === 'rate_limited' ? 'rate_limited' : 'generic',
      );
      setCreating(false);
    }
  }

  async function handleRemoveGame(entry: LibraryEntry) {
    const device = loadDevice();
    if (device === null) {
      return;
    }
    setLibrary((entries) => entries.filter((item) => item.id !== entry.id));
    try {
      await deleteFromLibrary(device, entry.id);
    } catch {
      // The list already dropped it; a refetch on the next visit reconciles.
    }
  }

  const normalized = normalizeRoomCode(code);

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
          {createError !== null && (
            <p className="m-0 text-ui text-bad-hi" role="alert">
              ⚠ {createError === 'rate_limited' ? t('home.rateLimited') : t('home.createError')}
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
              className={`${input({ mono: true, invalid: error })} text-center text-lead tracking-[0.5em]`}
              placeholder={t('home.joinPlaceholder')}
              value={code}
              onChange={(event) => {
                setCode(filterCodeInput(event.target.value));
                setError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleJoin();
                }
              }}
            />
            <p className="m-0 mt-1 text-right text-note text-faint tabular-nums">
              {t('home.charCount', { count: normalized.length })}
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
              ⚠ {t('home.joinError')}
            </p>
          )}
        </section>
      </div>

      {library.length > 0 && (
        <section className={`${panel({ layout: 'none', pad: 'none' })} w-full max-w-3xl`}>
          <div className={panelHeader()}>
            <h2 className="m-0">{t('home.libraryTitle')}</h2>
            <span className="text-faint tabular-nums">{library.length}</span>
          </div>
          <ul className="m-0 flex max-h-64 flex-col gap-0.5 overflow-y-auto p-2">
            {library.map((entry) => (
              <li key={entry.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className={`${listRow()} rounded-control`}
                  onClick={() => void handleOpenGame(entry)}
                >
                  <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                  <span className="shrink-0 text-note text-faint tabular-nums">
                    {t('home.libraryPlies', { count: entry.tree.mainline_ply_count })}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={t('home.removeGame')}
                  title={t('home.removeGame')}
                  className={button({ intent: 'ghost', size: 'xs' })}
                  onClick={() => void handleRemoveGame(entry)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
        {formatRegion(region) !== null && (
          <span data-testid="home-region">
            · {t('home.connectedTo', { region: formatRegion(region) })}
          </span>
        )}
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
