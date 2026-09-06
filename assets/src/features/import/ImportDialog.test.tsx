import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImportDialog from '@/features/import/ImportDialog';

type FetchStub = Record<string, (init?: RequestInit) => Promise<Response>>;

function stubFetch(routes: FetchStub) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const handler = routes[url];
      if (!handler) {
        throw new Error(`unmocked fetch: ${url}`);
      }
      return handler(init);
    }),
  );
}

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

const tree = {
  headers: { White: 'Alice', Black: 'Bob', Event: 'Test Game' },
  result: '*',
  setup: null,
  mainline_ply_count: 4,
  node_count: 7,
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
    fen: null,
    children: [],
  },
};

// 1. e4 {[%eval] comment} with mainline e5 and a variation c5.
const annotated = {
  ...tree,
  root: {
    ...tree.root,
    children: [
      {
        ...tree.root,
        id: 1,
        ply: 1,
        san: 'e4',
        from: 'e2',
        to: 'e4',
        comment: '[%eval 0.3] Sharp.',
        children: [
          { ...tree.root, id: 2, ply: 2, san: 'e5', from: 'e7', to: 'e5' },
          { ...tree.root, id: 3, ply: 2, san: 'c5', from: 'c7', to: 'c5' },
        ],
      },
    ],
  },
};

const pgn = '1. e4 e5 *\n';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem('blunderfest.chesscom-user');
});

describe('ImportDialog', () => {
  it('previews pasted PGN as pre-checked tray rows, then imports on confirmation', async () => {
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ tree }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: pgn } });

    expect(await screen.findByText('Valid PGN')).toBeInTheDocument();
    const row = screen.getByRole('checkbox', { name: /Alice – Bob/ });
    expect(row).toBeChecked();
    expect(onImported).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Import 1 game' }));
    expect(onImported).toHaveBeenCalledWith([expect.objectContaining({ headers: tree.headers })]);
  });

  it('shows every parsed game; unchecking one excludes it from the import', async () => {
    const other = { ...tree, headers: { White: 'Carol', Black: 'Dave' }, result: '0-1' };
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ trees: [tree, other] }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} />);

    const multiPgn = '[Event "G1"]\n\n1. e4 e5 *\n\n[Event "G2"]\n\n1. d4 d5 *\n';
    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: multiPgn } });

    expect(await screen.findByText('2 games found')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Alice – Bob/ })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /Carol – Dave/ }));
    expect(screen.getByRole('button', { name: 'Import 1 game' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Import 1 game' }));
    const trees = onImported.mock.calls[0][0] as (typeof tree)[];
    expect(trees).toHaveLength(1);
    expect(trees[0].headers).toEqual(tree.headers);
  });

  it('reports skipped games as red rows but still imports the good ones', async () => {
    stubFetch({
      '/api/import/pgn': () =>
        jsonResponse({
          trees: [tree],
          failures: [{ index: 2, detail: { reason: 'invalid_san_format', san: 'garbage' } }],
        }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} />);

    const mixedPgn = '[Event "G1"]\n\n1. e4 e5 *\n\n[Event "G2"]\n\n1. d4 garbage *\n';
    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: mixedPgn } });

    const failures = await screen.findAllByTestId('import-failure-row');
    expect(failures).toHaveLength(1);
    expect(failures[0]).toHaveTextContent('illegal or unknown move (garbage)');

    fireEvent.click(screen.getByRole('button', { name: 'Import 1 game' }));
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(onImported.mock.calls[0][0]).toHaveLength(1);
  });

  it('keep options live in the popover: evals stripped by default, metadata on uncheck', async () => {
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ tree: annotated }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: pgn } });
    await screen.findByText('Valid PGN');

    fireEvent.click(screen.getByRole('button', { name: /Options/ }));
    // Checked = kept. Engine annotations are the one exclusion by default.
    expect(screen.getByRole('checkbox', { name: 'Engine annotations' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Comments' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Names & event' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Variations' }));
    // Close the popover; the dot badge marks the non-default choice.
    fireEvent.click(screen.getByRole('button', { name: /Options/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Import 1 game' }));
    const imported = (onImported.mock.calls[0][0] as (typeof annotated)[])[0];
    const first = imported.root.children[0];
    // The eval marker is gone but the human comment survives...
    expect(first.comment).toBe('Sharp.');
    // ...metadata is stripped...
    expect(imported.headers).toEqual({});
    // ...and only the mainline remains.
    expect(first.children).toHaveLength(1);
    expect(first.children[0].san).toBe('e5');
  });

  it('Enter in the paste box confirms the tray', async () => {
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ tree }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: pgn } });
    await screen.findByText('Valid PGN');
    fireEvent.keyDown(screen.getByLabelText('PGN'), { key: 'Enter' });

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
  });

  it('shows every source in the rail even unlinked; a Lichess URL fetches into the tray', async () => {
    stubFetch({
      '/api/import/lichess': () => jsonResponse({ tree }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} />);

    // Chess.com needs no account — the rail never hides it.
    expect(screen.getByRole('tab', { name: 'Chess.com' })).toBeInTheDocument();
    // The linked browsers stay hidden until an account is linked.
    fireEvent.click(screen.getByRole('tab', { name: 'Lichess' }));
    expect(screen.queryByRole('tab', { name: 'My Lichess studies' })).toBeNull();
    expect(screen.getByText('Link your Lichess account →')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Lichess game URL or ID'), {
      target: { value: 'https://lichess.org/abc12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch' }));

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Alice – Bob/ })).toBeChecked(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 game' }));
    expect(onImported).toHaveBeenCalledWith([expect.objectContaining({ headers: tree.headers })]);
  });

  it('imports selected recent games with the keep options applied', async () => {
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
    stubFetch({
      '/api/lichess/games?profile_id=profile-1&max=10': () =>
        jsonResponse({
          games: [
            { id: 'g1', white: 'dr_ny', black: 'someone', result: '1-0', date: 1, speed: 'blitz' },
          ],
        }),
      '/api/import/lichess-games': () => jsonResponse({ trees: [annotated], failures: [] }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} lichessLinked />);

    fireEvent.click(screen.getByRole('tab', { name: 'Lichess' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /dr_ny – someone/ }));

    // The options popover is reachable before the import (a setting, not
    // content that appears late).
    fireEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.getByRole('checkbox', { name: 'Engine annotations' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Options/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Import 1 game' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    const imported = (onImported.mock.calls[0][0] as (typeof annotated)[])[0];
    expect(imported.root.children[0].comment).toBe('Sharp.');
  });

  it('auto-loads a remembered chess.com username and imports the selection', async () => {
    localStorage.setItem('blunderfest.chesscom-user', 'hikaru');
    localStorage.setItem(
      'blunderfest.device',
      JSON.stringify({ id: 'profile-1', secret: 'the-secret' }),
    );
    const now = new Date();
    const monthParam = `year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
    stubFetch({
      [`/api/chesscom/games?profile_id=profile-1&username=hikaru&${monthParam}`]: () =>
        jsonResponse({
          games: [
            {
              id: 'cc1',
              white: 'BornForTheEndgame',
              black: 'Hikaru',
              result: '0-1',
              date: 1,
              speed: 'blitz',
              pgn: '1. d4 d5 *',
            },
          ],
        }),
      '/api/import/pgn': () => jsonResponse({ tree }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} lichessLinked />);

    // Opening the pane auto-loads the remembered username — no Load click.
    fireEvent.click(screen.getByRole('tab', { name: 'Chess.com' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /BornForTheEndgame – Hikaru/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Import 1 game' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
  });

  it('parses a Lichess URL pasted into the paste box', async () => {
    stubFetch({
      '/api/import/lichess': () => jsonResponse({ tree }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('PGN'), {
      target: { value: 'https://lichess.org/abc123' },
    });

    expect(await screen.findByText('1 Lichess link')).toBeInTheDocument();
    await screen.findByRole('checkbox', { name: /Alice – Bob/ });
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 game' }));
    expect(onImported).toHaveBeenCalledWith([expect.objectContaining({ headers: tree.headers })]);
  });
});
