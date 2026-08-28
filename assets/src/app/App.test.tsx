import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '@/app/App';
import { store } from '@/store';
import { leaveRoom } from '@/store/room';
import { FakeChannel } from '@/test/fakeChannel';

const socketMocks = vi.hoisted(() => ({
  channelFor: vi.fn(),
}));

vi.mock('@/lib/socket', () => ({ channelFor: socketMocks.channelFor }));

type FetchStub = Record<string, () => Promise<Response>>;

function stubFetch(routes: FetchStub) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const handler = routes[url];
      if (!handler) {
        throw new Error(`unmocked fetch: ${url}`);
      }
      return handler();
    }),
  );
}

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

const profileBody = {
  profile: { id: 'profile-1', name: 'Brave Otter 42', created_at: '2026-01-01T00:00:00Z' },
  secret: 'the-secret',
};

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
  socketMocks.channelFor.mockReset();
  store.dispatch(leaveRoom());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the app name and tagline', () => {
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => new Promise(() => {}),
    });
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(screen.getByRole('heading', { name: 'Blunderfest' })).toBeInTheDocument();
    expect(screen.getByText('Collaborative chess analysis.')).toBeInTheDocument();
  });

  it('reports the backend as online when healthz succeeds', async () => {
    stubFetch({
      '/api/healthz': () => Promise.resolve(new Response(null, { status: 200 })),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    const status = await screen.findByText('Analysis service online');
    expect(status).toHaveAttribute('data-status', 'ok');
  });

  it('reports the backend as unreachable when healthz fails', async () => {
    stubFetch({
      '/api/healthz': () => Promise.resolve(new Response(null, { status: 503 })),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    const status = await waitFor(() => screen.getByText('Analysis service unreachable'));
    expect(status).toHaveAttribute('data-status', 'down');
  });

  it('creates an anonymous profile on first visit and shows the generated name', async () => {
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(await screen.findByText('Brave Otter 42')).toBeInTheDocument();
    expect(localStorage.getItem('blunderfest.device')).toBe(
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
  });

  it('reuses a stored device token on later visits', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );

    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles/profile-1': () => jsonResponse({ profile: profileBody.profile }),
    });
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(await screen.findByText('Brave Otter 42')).toBeInTheDocument();
  });

  it('creates a fresh profile when the stored device is unauthorized', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'stale-profile', secret: 'stale-secret' }),
    );

    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles/stale-profile': () => jsonResponse({ errors: { code: 'unauthorized' } }, 401),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(await screen.findByText('Brave Otter 42')).toBeInTheDocument();
    expect(localStorage.getItem('blunderfest.device')).toBe(
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
  });

  it('creates a room and navigates to the room screen', async () => {
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
      '/api/rooms': () => jsonResponse({ code: 'abcde' }, 201),
    });
    const channel = new FakeChannel();
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    socketMocks.channelFor.mockReturnValue(channel);
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    // Creating waits for the resolved profile (owner recorded at creation).
    expect(await screen.findByText('Brave Otter 42')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));

    await waitFor(() => {
      expect(window.location.hash).toMatch(/^#\/r\/[a-z0-9]{5}$/);
    });
    const code = window.location.hash.slice(-5);
    expect(await screen.findByText(code.toUpperCase())).toBeInTheDocument();
  });

  it('follows a re-healed device identity when room creation 401s once', async () => {
    // A stored device whose profile is gone server-side: the create 401s,
    // withDeviceRetry mints a fresh profile and retries — and the app must
    // JOIN the room as the new profile (the room is owned by it), not keep
    // acting as the stale one. Regression test: before the re-heal event,
    // the creator landed in their own room as a viewer.
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'stale-profile', secret: 'stale-secret' }),
    );
    const freshBody = {
      profile: { id: 'profile-2', name: 'Fresh Lynx 99', created_at: '2026-01-01T00:00:00Z' },
      secret: 'fresh-secret',
    };
    let roomPosts = 0;
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles/stale-profile': () =>
        jsonResponse(
          { profile: { id: 'stale-profile', name: 'Old Otter 42', created_at: '2026-01-01' } },
          200,
        ),
      '/api/profiles/stale-profile/library': () => jsonResponse({ entries: [] }),
      '/api/profiles/profile-2': () => jsonResponse({ profile: freshBody.profile }, 200),
      '/api/profiles/profile-2/library': () => jsonResponse({ entries: [] }),
      '/api/profiles': () => jsonResponse(freshBody, 201),
      '/api/rooms': () =>
        roomPosts++ === 0
          ? jsonResponse({ errors: { code: 'unauthorized' } }, 401)
          : jsonResponse({ code: 'abcde' }, 201),
    });
    const channel = new FakeChannel();
    channel.joinReturn = { ops: [], roles: { 'profile-2': 'owner' } };
    socketMocks.channelFor.mockReturnValue(channel);
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Create a room' }));

    // The app re-reads its identity after the re-heal…
    expect(await screen.findByText('Fresh Lynx 99')).toBeInTheDocument();
    // …and the room channel (re)joins as the new profile, so the recorded
    // owner role lands — the owner empty state, not the viewer's.
    await waitFor(() =>
      expect(socketMocks.channelFor).toHaveBeenLastCalledWith(expect.any(String), {
        profile_id: 'profile-2',
        name: 'Fresh Lynx 99',
      }),
    );
    expect(await screen.findByText('Empty room')).toBeInTheDocument();
    expect(document.getElementById('add-game-button')).toBeInTheDocument();
  });

  it('joins a room from the code input', async () => {
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    const channel = new FakeChannel();
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    socketMocks.channelFor.mockReturnValue(channel);
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    fireEvent.change(screen.getByPlaceholderText('Room code'), { target: { value: 'xyz99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    await waitFor(() => expect(window.location.hash).toBe('#/r/xyz99'));
    expect(await screen.findByText('XYZ99')).toBeInTheDocument();
  });

  it('renders a room directly from a deep link', async () => {
    window.location.hash = '#/r/abcde';
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    const channel = new FakeChannel();
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    socketMocks.channelFor.mockReturnValue(channel);
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(await screen.findByText('ABCDE')).toBeInTheDocument();
  });

  it('shows the room code, copy and leave buttons to everyone in the room', async () => {
    window.location.hash = '#/r/abcde';
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    socketMocks.channelFor.mockReturnValue(new FakeChannel());
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(await screen.findByText('ABCDE')).toBeInTheDocument();
    // Code copy is header chrome (ADR-0032); leaving is the logo.
    expect(screen.getByRole('button', { name: 'Room code' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Blunderfest' })).toBeInTheDocument();
  });

  it('waits for the identity before joining the room channel', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
    window.location.hash = '#/r/abcde';

    let resolveProfile: (response: Response) => void = () => {};
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles/profile-1': () =>
        new Promise((resolve) => {
          resolveProfile = resolve;
        }),
    });
    socketMocks.channelFor.mockReturnValue(new FakeChannel());
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(screen.getAllByText('Preparing your identity...').length).toBeGreaterThan(0);
    expect(socketMocks.channelFor).not.toHaveBeenCalled();

    resolveProfile(
      new Response(JSON.stringify({ profile: profileBody.profile }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    // Joined (and only then): the room's sidebar appears.
    expect(await screen.findByTestId('room-sidebar')).toBeInTheDocument();
    await waitFor(() =>
      expect(socketMocks.channelFor).toHaveBeenCalledWith('room:abcde', {
        profile_id: 'profile-1',
        name: 'Brave Otter 42',
      }),
    );
  });

  it('shows a not-found screen for a deep link to a room that was never created', async () => {
    window.location.hash = '#/r/zzzqq';
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    const channel = new FakeChannel();
    channel.joinError = { reason: 'room_not_found' };
    socketMocks.channelFor.mockReturnValue(channel);
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(await screen.findByText('Room not found')).toBeInTheDocument();
  });

  it('ignores deep links with malformed room codes', async () => {
    window.location.hash = '#/r/kjhkjhkjhkj';
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => new Promise(() => {}),
    });
    socketMocks.channelFor.mockReturnValue(new FakeChannel());
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(screen.getByRole('button', { name: 'Create a room' })).toBeInTheDocument();
    expect(socketMocks.channelFor).not.toHaveBeenCalled();
  });

  it('resets the selected game when switching rooms without leaving', async () => {
    const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const gameOp = (seq: number, gameId: string, white: string) => ({
      seq,
      author: 'profile-1',
      ts: '2026-01-01T00:00:00Z',
      type: 'set_game' as const,
      payload: {
        game_id: gameId,
        tree: {
          headers: { White: white, Black: 'Bob' },
          result: '*',
          setup: null,
          mainline_ply_count: 0,
          node_count: 1,
          root: {
            id: 0,
            ply: 0,
            san: null,
            from: null,
            to: null,
            promotion: null,
            comment: null,
            nags: [],
            status: 'active',
            fen: START_FEN,
            children: [],
          },
        },
      },
    });

    window.location.hash = '#/r/aaaaa';
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    const channelA = new FakeChannel();
    channelA.joinReturn = {
      ops: [gameOp(1, 'game-a1', 'Alice'), gameOp(2, 'game-a2', 'Carol')],
      roles: { 'profile-1': 'owner' },
    };
    const channelB = new FakeChannel();
    channelB.joinReturn = {
      ops: [gameOp(1, 'game-b1', 'Zoe')],
      roles: { 'profile-1': 'owner' },
    };
    socketMocks.channelFor.mockImplementation((topic: string) =>
      topic === 'room:aaaaa' ? channelA : channelB,
    );
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    // In room A, select the second game explicitly (the games rail is chrome).
    fireEvent.click(await screen.findByRole('button', { name: 'Carol – Bob' }));
    expect(await screen.findByRole('heading', { name: 'Carol – Bob' })).toBeInTheDocument();

    // Switch rooms via a hash change (no Leave in between): the selected
    // game from room A must not leak into room B — its first game shows.
    act(() => {
      window.location.hash = '#/r/bbbbb';
    });

    expect(await screen.findByRole('heading', { name: 'Zoe – Bob' })).toBeInTheDocument();
    expect(screen.queryByText('Import a game to start analyzing.')).not.toBeInTheDocument();
  });

  it('leaves a room back to the home screen', async () => {
    window.location.hash = '#/r/abcde';
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    const channel = new FakeChannel();
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    socketMocks.channelFor.mockReturnValue(channel);
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    // Leaving the room is the logo (ADR-0032): it navigates home, which
    // unmounts the room and drops the channel.
    fireEvent.click(await screen.findByRole('link', { name: 'Blunderfest' }));

    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(screen.getByRole('button', { name: 'Create a room' })).toBeInTheDocument();
  });

  it('cycles the theme through dark, system and light from the header', async () => {
    localStorage.setItem('blunderfest.theme', 'dark');
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Theme: dark' }));
    // System follows the OS (light in tests, per the matchMedia stub).
    expect(await screen.findByRole('button', { name: /Theme: system/ })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: /Theme: system/ }));
    expect(document.documentElement.dataset.theme).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: 'Theme: light' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('has no axe violations on the home screen', async () => {
    stubFetch({
      '/api/healthz': () => Promise.resolve(new Response(null, { status: 200 })),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    const view = render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    await screen.findByText('Analysis service online');
    const results = await axe(view.container);
    expect(results).toHaveNoViolations();
  });

  it('offers the guided tour from the help menu in a room', async () => {
    window.location.hash = '#/r/abcde';
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    const channel = new FakeChannel();
    channel.joinReturn = { ops: [], roles: { 'profile-1': 'owner' } };
    socketMocks.channelFor.mockReturnValue(channel);
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Help' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Take the guided tour' }));

    expect(await screen.findByText('The games rail')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByText('The games rail')).not.toBeInTheDocument();
  });

  it('does not offer the tour on the landing page', async () => {
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/profiles': () => jsonResponse(profileBody, 201),
    });
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Help' }));
    expect(screen.queryByRole('menuitem', { name: 'Take the guided tour' })).toBeNull();
  });

  it('recovers a profile from a Lichess exchange code in the URL', async () => {
    window.location.hash = '#/?exchange=code-123';
    stubFetch({
      '/api/healthz': () => new Promise(() => {}),
      '/api/auth/exchange': () => jsonResponse(profileBody, 200),
    });
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    expect(await screen.findByText('Brave Otter 42')).toBeInTheDocument();
    expect(localStorage.getItem('blunderfest.device')).toBe(
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
    expect(window.location.hash).toBe('#/');
  });
});
