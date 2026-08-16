import { fireEvent, render, screen } from '@testing-library/react';
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

const pgn = '1. e4 e5 *\n';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ImportDialog', () => {
  it('previews pasted PGN, then imports only on confirmation', async () => {
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ tree }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: pgn } });

    expect(await screen.findByText('Valid PGN')).toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(onImported).toHaveBeenCalledWith([expect.objectContaining({ headers: tree.headers })]);
  });

  it('previews a multi-game PGN and imports every game on confirmation', async () => {
    const other = { ...tree, headers: { White: 'Carol', Black: 'Dave' }, result: '0-1' };
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ trees: [tree, other] }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} />);

    const multiPgn = '[Event "G1"]\n\n1. e4 e5 *\n\n[Event "G2"]\n\n1. d4 d5 *\n';
    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: multiPgn } });

    expect(await screen.findByText('2 games found')).toBeInTheDocument();
    expect(screen.getByText('Alice – Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol – Dave')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    const trees = onImported.mock.calls[0][0] as (typeof tree)[];
    expect(trees).toHaveLength(2);
    expect(trees[0].headers).toEqual(tree.headers);
    expect(trees[1].headers).toEqual(other.headers);
  });

  it('reports skipped games of a mixed multi-game PGN but still imports the good ones', async () => {
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

    const alert = await screen.findByTestId('import-failures');
    expect(alert).toHaveTextContent("Some games couldn't be parsed and were skipped");
    expect(alert).toHaveTextContent('Game 2: illegal or unknown move (garbage)');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(onImported.mock.calls[0][0]).toHaveLength(1);
  });

  it('parses a Lichess URL via the lichess endpoint', async () => {
    stubFetch({
      '/api/import/lichess': () => jsonResponse({ tree }),
    });
    render(<ImportDialog onImported={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('PGN'), {
      target: { value: 'https://lichess.org/abc123' },
    });

    expect(await screen.findByText('Valid PGN')).toBeInTheDocument();
    expect(screen.getByText('lichess')).toBeInTheDocument();
  });

  it('shows the error message when the PGN is invalid', async () => {
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ errors: { code: 'invalid_pgn' } }, 422),
    });
    render(<ImportDialog onImported={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: 'not pgn' } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't import it");
    expect(alert).toHaveTextContent('This PGN could not be parsed.');
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('keeps the import disabled while the input is empty', () => {
    render(<ImportDialog onImported={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('closes on Escape and on backdrop click', () => {
    const onClose = vi.fn();
    render(<ImportDialog onImported={vi.fn()} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement;
    if (backdrop === null) {
      throw new Error('expected a backdrop around the dialog');
    }
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('seeds a sample game with Use sample', async () => {
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ tree }),
    });
    render(<ImportDialog onImported={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Use sample' }));

    expect((screen.getByLabelText('PGN') as HTMLTextAreaElement).value).toContain(
      '[Event "Friendly sample"]',
    );
    expect(await screen.findByText('Valid PGN')).toBeInTheDocument();
  });

  it('excludes engine annotations by default and variations on uncheck', async () => {
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
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ tree: annotated }),
    });
    const onImported = vi.fn();
    render(<ImportDialog onImported={onImported} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('PGN'), { target: { value: pgn } });
    expect(await screen.findByText('Valid PGN')).toBeInTheDocument();

    // Checked = kept. Engine annotations are the one exclusion by default.
    expect(screen.getByRole('checkbox', { name: 'Engine annotations' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Comments' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Names & event' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Variations' }));

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const imported = (onImported.mock.calls[0][0] as (typeof annotated)[])[0];
    const first = imported.root.children[0];
    // The eval marker is gone but the human comment survives...
    expect(first.comment).toBe('Sharp.');
    // ...and only the mainline remains.
    expect(first.children).toHaveLength(1);
    expect(first.children[0].san).toBe('e5');
  });
});
