import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Logo from '@/components/Logo';
import Home from '@/features/home/Home';
import RoomHeader from '@/features/room/RoomHeader';
import RoomView from '@/features/room/RoomView';
import { useProfile } from '@/lib/useProfile';

export type BackendStatus = 'checking' | 'ok' | 'down';

type Route = { screen: 'home' } | { screen: 'room'; slug: string };

function readHashRoute(): Route {
  const match = window.location.hash.match(/^#\/r\/([abcdefghjkmnpqrstuvwxyz23456789]{5})$/);
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
  const [region, setRegion] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(readHashRoute);
  const profile = useProfile();
  const mainRef = useRef<HTMLElement | null>(null);
  const firstRender = useRef(true);

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

  const selfId = profile.status === 'ready' ? profile.profile.id : null;
  const selfName = profile.status === 'ready' ? profile.profile.name : null;

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
      <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-2">
        <a href="#/" aria-label={t('app.name')} className="text-ink no-underline">
          <Logo size="sm" />
        </a>
        {route.screen === 'room' && <RoomHeader slug={route.slug} onLeave={navigateHome} />}
        <p className="m-0 text-ui text-muted" role="status" data-status={profile.status}>
          {name}
        </p>
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
          <RoomView slug={route.slug} onLeave={navigateHome} selfId={selfId} selfName={selfName} />
        )}
      </main>
    </div>
  );
}
