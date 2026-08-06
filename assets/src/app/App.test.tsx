import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));

    await waitFor(() => {
      expect(window.location.hash).toMatch(/^#\/r\/[a-z0-9]{5}$/);
    });
    const code = window.location.hash.slice(-5);
    expect(await screen.findByText(code.toUpperCase())).toBeInTheDocument();
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

  it('hides the room code and leave button from non-owners', async () => {
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

    expect(await screen.findByTestId('member-list')).toBeInTheDocument();
    expect(screen.queryByText('ABCDE')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave room' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
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

    expect(await screen.findByTestId('member-list')).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('button', { name: 'Leave room' }));

    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(screen.getByRole('button', { name: 'Create a room' })).toBeInTheDocument();
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
});
