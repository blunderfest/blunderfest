import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Home from '@/features/home/Home';
import RoomView from '@/features/room/RoomView';
import { useProfile } from '@/lib/useProfile';

export type BackendStatus = 'checking' | 'ok' | 'down';

type Route = { screen: 'home' } | { screen: 'room'; slug: string };

function readHashRoute(): Route {
  const match = window.location.hash.match(/^#\/r\/([a-z0-9]+)$/);
  if (match) {
    return { screen: 'room', slug: match[1] };
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
  const [route, setRoute] = useState<Route>(readHashRoute);
  const profile = useProfile();
  const mainRef = useRef<HTMLElement | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/healthz', { signal: controller.signal })
      .then((response) => setBackend(response.ok ? 'ok' : 'down'))
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

  return (
    <div className="flex min-h-screen flex-col">
      <button
        type="button"
        id="skip-to-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-surface"
        onClick={() => mainRef.current?.focus()}
      >
        {t('app.skipToBoard')}
      </button>
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-3">
        <a href="#/" className="text-sm font-semibold tracking-[-0.01em] text-ink no-underline">
          {t('app.name')}
        </a>
        <p className="m-0 text-sm text-muted" role="status" data-status={profile.status}>
          {name}
        </p>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="flex flex-1 flex-col">
        {route.screen === 'home' ? (
          <Home backend={backend} onJoin={navigateToRoom} />
        ) : (
          <RoomView
            slug={route.slug}
            onLeave={navigateHome}
            selfId={profile.status === 'ready' ? profile.profile.id : null}
            selfName={profile.status === 'ready' ? profile.profile.name : null}
          />
        )}
      </main>
    </div>
  );
}
