import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccountMenu from '@/app/AccountMenu';
import HelpMenu from '@/app/HelpMenu';
import Logo from '@/components/Logo';
import UpdateBanner from '@/components/UpdateBanner';
import Home from '@/features/home/Home';
import RoomView from '@/features/room/RoomView';
import { roomSteps } from '@/features/tour/steps';
import Tour from '@/features/tour/Tour';
import { hasNewVersion, loadInitialVersion } from '@/lib/appVersion';
import { roomCodeInHash } from '@/lib/roomCode';
import { getTheme, setTheme, type Theme } from '@/lib/theme';
import { useProfile } from '@/lib/useProfile';

export type BackendStatus = 'checking' | 'ok' | 'down';

type Route = { screen: 'home' } | { screen: 'room'; slug: string };

function readHashRoute(): Route {
  const code = roomCodeInHash(window.location.hash);
  if (code !== null) {
    return { screen: 'room', slug: code };
  }
  return { screen: 'home' };
}

function navigateToRoom(slug: string) {
  window.location.hash = `#/r/${slug}`;
}

function navigateHome() {
  window.location.hash = '#/';
}

export default function App() {
  const { t } = useTranslation();
  const [backend, setBackend] = useState<BackendStatus>('checking');
  const [region, setRegion] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(readHashRoute);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const profile = useProfile();
  const mainRef = useRef<HTMLElement | null>(null);
  const firstRender = useRef(true);

  // The version beacon: this tab learns about new deployments and offers
  // a reload instead of silently running the old bundle.
  useEffect(() => {
    let cancelled = false;
    let interval: number | null = null;
    const onOnline = () => {
      initialVersion.then((version) => {
        if (!cancelled && version !== null) {
          check(version);
        }
      });
    };

    const check = (initial: string | null) => {
      hasNewVersion(initial).then((fresh) => {
        if (!cancelled && fresh) {
          setUpdateAvailable(true);
        }
      });
    };

    const initialVersion = loadInitialVersion();

    initialVersion.then((version) => {
      if (cancelled || version === null) {
        return;
      }
      interval = window.setInterval(() => check(version), 60_000);
      window.addEventListener('online', onOnline);
    });

    return () => {
      cancelled = true;
      if (interval !== null) {
        window.clearInterval(interval);
      }
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/healthz', { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) {
          const body = (await response.json().catch(() => null)) as {
            region?: string;
          } | null;
          setRegion(body?.region ?? null);
          setBackend('ok');
        } else {
          setBackend('down');
        }
      })
      .catch(() => setBackend('down'));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(readHashRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Move focus to the new screen on route changes so keyboard and screen
  // reader users aren't dropped mid-page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the route (screen) changes
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [route]);

  const name =
    profile.status === 'ready'
      ? profile.profile.name
      : profile.status === 'error'
        ? t('profile.error')
        : t('profile.loading');

  // Guided tour — room-only (the landing page doesn't need one), started
  // from the help menu. The nonce forces a remount on every re-trigger so
  // the steps re-resolve against the current DOM.
  const [tour, setTour] = useState<{ screen: Route['screen']; nonce: number } | null>(null);

  // The tour's steps anchor to screen-specific UI; a route change ends it.
  const tourRoute = useRef(route);
  useEffect(() => {
    if (tourRoute.current !== route) {
      tourRoute.current = route;
      setTour(null);
    }
  }, [route]);

  function startTour() {
    setTour((current) => ({ screen: route.screen, nonce: (current?.nonce ?? 0) + 1 }));
  }

  function closeTour() {
    setTour(null);
  }

  const selfId = profile.status === 'ready' ? profile.profile.id : null;
  const selfName = profile.status === 'ready' ? profile.profile.name : null;

  // The app bar's room slot (ADR-0031): the room portals its Share button
  // and presence strip here — room chrome rides the app bar while the app
  // bar stays app-level (the room fills the slot; the shell owns it).
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  // The inline script in index.html sets data-theme before first paint.
  const [theme, setThemeState] = useState<Theme>(getTheme);

  // Cycles system → light → dark → system.
  function toggleTheme() {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    setThemeState(next);
  }

  const themeLabel =
    theme === 'system'
      ? t('app.themeSystem')
      : theme === 'light'
        ? t('app.themeLight')
        : t('app.themeDark');

  return (
    <div className="flex min-h-screen flex-col">
      <button
        type="button"
        id="skip-to-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-surface"
        onClick={() => mainRef.current?.focus()}
      >
        {t('app.skipToContent')}
      </button>
      <header className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-surface px-4 py-2">
        <div className="flex items-center gap-3">
          <a href="#/" aria-label={t('app.name')} className="text-ink no-underline">
            <Logo size="sm" />
          </a>
        </div>
        <div className="flex items-center gap-3">
          <div ref={setHeaderSlot} className="flex items-center gap-2" data-testid="header-slot" />
          <HelpMenu onStartTour={startTour} showTour={route.screen === 'room'} />
          <button
            type="button"
            id="theme-toggle"
            aria-label={themeLabel}
            title={themeLabel}
            className="grid h-7 w-7 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
            onClick={toggleTheme}
          >
            {theme === 'light' && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            )}
            {theme === 'dark' && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
            )}
            {theme === 'system' && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <path d="M9 20h6M12 16v4" />
              </svg>
            )}
          </button>
          {profile.status === 'ready' ? (
            <AccountMenu profile={profile.profile} />
          ) : (
            <p
              className="m-0 hidden text-ui text-muted md:block"
              role="status"
              data-status={profile.status}
            >
              {name}
            </p>
          )}
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="flex flex-1 flex-col">
        {route.screen === 'home' ? (
          <Home
            backend={backend}
            region={region}
            userName={profile.status === 'ready' ? name : null}
            onJoin={navigateToRoom}
          />
        ) : profile.status === 'loading' ? (
          // Wait for the identity before joining the room channel: joining
          // anonymously and rejoining once the profile loads leaves a ghost
          // "anonymous" presence entry and a window without edit rights.
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="m-0 text-muted">{t('profile.loading')}</p>
          </div>
        ) : (
          // Keyed by slug: switching rooms without leaving (a hash change
          // room→room) must remount, not carry over the previous room's
          // local state (selected game, follow override).
          <RoomView
            key={route.slug}
            slug={route.slug}
            onLeave={navigateHome}
            selfId={selfId}
            selfName={selfName}
            lichessLinked={
              profile.status === 'ready' &&
              profile.profile.accounts?.some((account) => account.type === 'lichess') === true
            }
            headerSlot={headerSlot}
          />
        )}
      </main>
      {tour !== null && tour.screen === 'room' && (
        <Tour key={tour.nonce} steps={roomSteps} onClose={closeTour} />
      )}
      {updateAvailable && <UpdateBanner onReload={() => window.location.reload()} />}
    </div>
  );
}
