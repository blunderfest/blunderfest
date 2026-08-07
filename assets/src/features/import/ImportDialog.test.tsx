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
    expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ headers: tree.headers }));
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

    expect(await screen.findByText('⚠ This PGN could not be parsed.')).toBeInTheDocument();
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
});
