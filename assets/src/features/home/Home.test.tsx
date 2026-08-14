import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '@/features/home/Home';

function renderHome(onJoin = vi.fn()) {
  const utils = render(<Home backend="ok" userName="Brave Otter 42" onJoin={onJoin} />);
  return { onJoin, ...utils };
}

function stubCreateRoom(ok = true) {
  // Room creation carries the device identity; the library load answers empty.
  localStorage.setItem(
    'blunderfest.device',
    JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
  );
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/library')) {
      return Promise.resolve(
        new Response(JSON.stringify({ entries: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(ok ? { code: 'abcde' } : { errors: { code: 'invalid_code' } }), {
        status: ok ? 201 : 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem('blunderfest.device');
});

describe('Home', () => {
  it('shows the connected server region when known', () => {
    render(<Home backend="ok" region="ams" userName="Brave Otter 42" onJoin={vi.fn()} />);
    expect(screen.getByTestId('home-region')).toHaveTextContent('Connected to 🇳🇱 Amsterdam');
  });

  it('omits the region line while it is unknown', () => {
    renderHome();
    expect(screen.queryByTestId('home-region')).not.toBeInTheDocument();
  });

  it('creates a room on the server before joining with the code', async () => {
    const fetchMock = stubCreateRoom();
    const { onJoin } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
    const code = onJoin.mock.calls[0][0] as string;
    expect(code).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{5}$/);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rooms',
      expect.objectContaining({ method: 'POST' }),
    );
    const createCall = fetchMock.mock.calls.find(([url]) => url === '/api/rooms');
    const callArgs = createCall?.[1] as RequestInit;
    expect(JSON.parse(callArgs.body as string).code).toBe(code);
  });

  it('attaches the stored device so the creator is recorded as the owner', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 's3cr3t' }),
    );
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url) =>
        String(url).includes('/library')
          ? ({ ok: true, status: 200, json: async () => ({ entries: [] }) } as Response)
          : ({ ok: true, status: 201, json: async () => ({ code: 'abcde' }) } as Response),
      );
    const { onJoin } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));

    const createCall = fetchMock.mock.calls.find(([url]) => url === '/api/rooms');
    const init = createCall?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer s3cr3t');
    expect(JSON.parse(init.body as string).profile_id).toBe('profile-1');
  });

  it('cannot create a room until the profile has resolved', () => {
    render(<Home backend="ok" userName={null} onJoin={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Create a room' })).toBeDisabled();
  });

  it('re-heals a wiped profile and retries room creation on a 401', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'stale-profile', secret: 'stale-secret' }),
    );
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const href = String(url);
      if (href.includes('/library')) {
        return { ok: true, status: 200, json: async () => ({ entries: [] }) } as Response;
      }
      if (href === '/api/profiles') {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            profile: { id: 'fresh-profile', name: 'Newt', created_at: '…' },
            secret: 'fresh-secret',
          }),
        } as Response;
      }
      if (href === '/api/rooms') {
        const body = JSON.parse((init as RequestInit).body as string);
        return body.profile_id === 'fresh-profile'
          ? ({ ok: true, status: 201, json: async () => ({ code: 'abcde' }) } as Response)
          : ({
              ok: false,
              status: 401,
              json: async () => ({ errors: { code: 'unauthorized' } }),
            } as Response);
      }
      throw new Error(`unmocked fetch: ${href}`);
    });

    const { onJoin } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));

    // Stale create 401 → profile re-created → retried with the fresh identity.
    const roomPosts = fetchMock.mock.calls.filter(([url]) => url === '/api/rooms');
    expect(roomPosts).toHaveLength(2);
    const retryBody = JSON.parse((roomPosts[1][1] as RequestInit).body as string);
    expect(retryBody.profile_id).toBe('fresh-profile');
    expect(localStorage.getItem('blunderfest.device')).toBe(
      JSON.stringify({ id: 'fresh-profile', secret: 'fresh-secret' }),
    );
  });

  it('shows an error and stays home when room creation fails', async () => {
    stubCreateRoom(false);
    const { onJoin } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    expect(await screen.findByText(/Could not create the room/)).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('says so when the server rate-limits room creation', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      String(input).includes('/library')
        ? Promise.resolve(
            new Response(JSON.stringify({ entries: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        : Promise.resolve(
            new Response(JSON.stringify({ errors: { code: 'rate_limited' } }), {
              status: 429,
              headers: { 'Content-Type': 'application/json' },
            }),
          ),
    );
    const { onJoin } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    expect(await screen.findByText(/Too many rooms created/)).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('joins a room with a normalized code', () => {
    const { onJoin } = renderHome();
    fireEvent.change(screen.getByPlaceholderText('Room code'), { target: { value: ' AbC_3-9 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onJoin).toHaveBeenCalledWith('abc39');
  });

  it('filters disallowed characters and caps the length as you type', () => {
    renderHome();
    const field = screen.getByPlaceholderText('Room code');

    fireEvent.change(field, { target: { value: 'abi1o!' } });
    expect(field).toHaveValue('ab');

    fireEvent.change(field, { target: { value: 'abcdefgh' } });
    expect(field).toHaveValue('abcde');
  });

  it('shows an error when the code has the wrong length', () => {
    const { onJoin } = renderHome();
    fireEvent.change(screen.getByPlaceholderText('Room code'), {
      target: { value: 'abc' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByText(/Enter a room code/)).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('joins a room when pressing Enter in the input', () => {
    const { onJoin } = renderHome();
    fireEvent.change(screen.getByPlaceholderText('Room code'), { target: { value: 'xyz99' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Room code'), { key: 'Enter' });
    expect(onJoin).toHaveBeenCalledWith('xyz99');
  });

  it('shows an error when joining with an empty code', () => {
    const { onJoin } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByText(/Enter a room code/)).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });

  describe('library', () => {
    const libraryEntry = {
      id: 'entry-1',
      title: 'Anna – Boris',
      saved_at: '2026-08-11T00:00:00Z',
      tree: {
        headers: { White: 'Anna', Black: 'Boris' },
        result: '1-0',
        setup: null,
        mainline_ply_count: 4,
        node_count: 5,
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
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          children: [],
        },
      },
    };

    function stubLibrary(entries = [libraryEntry]) {
      localStorage.setItem(
        'blunderfest.device',
        JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
      );
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
        const url = String(input);
        if (url === '/api/profiles/profile-1/library') {
          return Promise.resolve(
            new Response(JSON.stringify({ entries }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (url.startsWith('/api/profiles/profile-1/library/')) {
          return Promise.resolve(new Response('{}', { status: 200 }));
        }
        if (url === '/api/rooms') {
          return Promise.resolve(
            new Response(JSON.stringify({ code: 'abcde' }), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        throw new Error(`unmocked fetch: ${url}`);
      });
      return fetchMock;
    }

    it('lists saved games and opens one in a fresh room', async () => {
      const fetchMock = stubLibrary();
      const onJoin = vi.fn();
      render(<Home backend="ok" userName="Brave Otter 42" onJoin={onJoin} />);

      const openButton = await screen.findByRole('button', { name: /Anna – Boris/ });
      fireEvent.click(openButton);

      // The room is created with the game seeded, then joined.
      await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
      const createCall = fetchMock.mock.calls.find(([url]) => url === '/api/rooms');
      if (!createCall) {
        throw new Error('expected a POST to /api/rooms');
      }
      const body = JSON.parse((createCall[1] as RequestInit).body as string);
      expect(body.tree).toEqual(libraryEntry.tree);
      expect(onJoin.mock.calls[0][0]).toMatch(/^[a-z0-9]{5}$/);
    });

    it('removes a game from the library', async () => {
      const fetchMock = stubLibrary();
      render(<Home backend="ok" userName="Brave Otter 42" onJoin={vi.fn()} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Remove from library' }));

      expect(screen.queryByRole('button', { name: /Anna – Boris/ })).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/profiles/profile-1/library/entry-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});

it('joins the demo room from the demo link', () => {
  const { onJoin } = renderHome();
  fireEvent.click(screen.getByRole('button', { name: /Peek at the demo room/ }));
  expect(onJoin).toHaveBeenCalledWith('chess');
});
