import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GameActions from '@/features/analysis/GameActions';
import type { GameTree } from '@/lib/api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const tree: GameTree = {
  headers: { White: 'Paul Morphy', Black: 'Duke Karl & Count Isouard' },
  result: '1-0',
  setup: null,
  mainline_ply_count: 1,
  node_count: 2,
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
    children: [
      {
        id: 1,
        ply: 1,
        san: 'e4',
        from: 'e2',
        to: 'e4',
        promotion: null,
        comment: null,
        nags: [],
        status: 'active',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        children: [],
      },
    ],
  },
};

describe('GameActions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem('blunderfest.device');
  });

  it('saves the game to the library', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ entry: { id: 'e1', title: 'Morphy game', saved_at: '…' } }),
    } as Response);

    render(<GameActions tree={tree} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save to library' }));

    expect(await screen.findByRole('button', { name: 'Saved ✓' })).toBeInTheDocument();
    // The first call is the mount-time library fetch; the save is the POST.
    const saveCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit).method === 'POST',
    );
    expect(saveCall).toBeDefined();
    expect(((saveCall as NonNullable<typeof saveCall>)[1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer the-secret',
    });
  });

  it('re-heals a wiped profile and retries once on a 401', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'stale-profile', secret: 'stale-secret' }),
    );
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const href = String(url);
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
      if (href.includes('stale-profile')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ errors: { code: 'unauthorized' } }),
        } as Response;
      }
      return {
        ok: true,
        status: 201,
        json: async () => ({ entry: { id: 'e1', title: 'Morphy game', saved_at: '…' } }),
      } as Response;
    });

    render(<GameActions tree={tree} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save to library' }));

    expect(await screen.findByRole('button', { name: 'Saved ✓' })).toBeInTheDocument();
    // Mount-time library fetch (401s), save 401, profile re-created, retried save.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(localStorage.getItem('blunderfest.device')).toBe(
      JSON.stringify({ id: 'fresh-profile', secret: 'fresh-secret' }),
    );
    const retry = fetchMock.mock.calls[3][1] as RequestInit;
    expect((retry.headers as Record<string, string>).Authorization).toBe('Bearer fresh-secret');
  });

  it('exports the game as a PGN download', async () => {
    const createObjectUrl = vi.fn().mockReturnValue('blob:mock');
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<GameActions tree={tree} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export PGN' }));

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    const blob = createObjectUrl.mock.calls[0][0] as Blob;
    // jsdom's Blob has no .text(); FileReader works everywhere.
    const pgn = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
    expect(pgn).toContain('[White "Paul Morphy"]');
    expect(pgn).toContain('1. e4 1-0');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:mock');
  });

  it('builds the filename from the players', async () => {
    const createObjectUrl = vi.fn().mockReturnValue('blob:mock');
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<GameActions tree={tree} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export PGN' }));

    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe('paul-morphy-vs-duke-karl-count-isouard.pgn');
  });

  it('shows a filled bookmark when the game is in the library; clicking removes it', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const href = String(url);
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (method === 'GET' && href.endsWith('/library')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            entries: [{ id: 'e1', title: 'Morphy game', saved_at: '…', tree }],
          }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    render(<GameActions tree={tree} />);

    const removeButton = await screen.findByRole('button', { name: 'Remove from library' });
    fireEvent.click(removeButton);

    // Optimistic: back to the outline + save label, and the DELETE went out.
    expect(await screen.findByRole('button', { name: 'Save to library' })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith('/library/e1') && (init as RequestInit).method === 'DELETE',
      ),
    ).toBe(true);
  });

  it('fills the bookmark after a save', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const method = (init as RequestInit | undefined)?.method ?? 'GET';
      if (method === 'GET' && String(url).endsWith('/library')) {
        return { ok: true, status: 200, json: async () => ({ entries: [] }) } as Response;
      }
      return {
        ok: true,
        status: 201,
        json: async () => ({ entry: { id: 'e9', title: 'Morphy game', saved_at: '…' } }),
      } as Response;
    });

    render(<GameActions tree={tree} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save to library' }));

    // The saved state flashes, and the membership flag is set right away.
    expect(await screen.findByRole('button', { name: 'Saved ✓' })).toHaveAttribute('data-filled');
  });
});
