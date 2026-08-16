import { afterEach, describe, expect, it, vi } from 'vitest';
import { importAnything, splitImportInput } from '@/features/import/importSources';

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
  headers: { White: 'Alice', Black: 'Bob' },
  result: '*',
  setup: null,
  mainline_ply_count: 2,
  node_count: 3,
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('splitImportInput', () => {
  it('routes whole Lichess URL lines to Lichess and keeps the rest as PGN', () => {
    expect(splitImportInput('1. e4 e5 *')).toEqual({ pgn: '1. e4 e5 *', lichessUrls: [] });
    expect(splitImportInput('https://lichess.org/abc12345')).toEqual({
      pgn: null,
      lichessUrls: ['https://lichess.org/abc12345'],
    });
    expect(
      splitImportInput('https://lichess.org/abc12345\nhttps://lichess.org/def67890/black'),
    ).toEqual({
      pgn: null,
      lichessUrls: ['https://lichess.org/abc12345', 'https://lichess.org/def67890/black'],
    });
  });

  it('separates a mixture of URLs and PGN', () => {
    const input = 'https://lichess.org/abc12345\n1. e4 e5 *\nhttps://lichess.org/def67890';
    expect(splitImportInput(input)).toEqual({
      pgn: '1. e4 e5 *',
      lichessUrls: ['https://lichess.org/abc12345', 'https://lichess.org/def67890'],
    });
  });

  it('keeps a URL inside a PGN comment in the PGN', () => {
    const input = '1. e4 {see https://lichess.org/abc12345} e5 *';
    expect(splitImportInput(input)).toEqual({ pgn: input, lichessUrls: [] });
  });

  it('treats bare game ids as PGN (unsupported)', () => {
    expect(splitImportInput('abc12345')).toEqual({ pgn: 'abc12345', lichessUrls: [] });
  });
});

describe('importAnything', () => {
  it('imports several Lichess URLs and reports the one that fails', async () => {
    stubFetch({
      '/api/import/lichess': (init) => {
        const url = JSON.parse(String(init?.body)) as { url: string };
        return url.url.endsWith('bad12345')
          ? jsonResponse({ errors: { code: 'lichess_game_not_found' } }, 404)
          : jsonResponse({ tree });
      },
    });

    const preview = await importAnything(
      'https://lichess.org/good1234\nhttps://lichess.org/bad12345\nhttps://lichess.org/alsogood1',
    );

    expect(preview.trees).toHaveLength(2);
    expect(preview.source).toBe('lichess');
    expect(preview.skips).toEqual([
      { kind: 'lichess', url: 'https://lichess.org/bad12345', code: 'lichess_game_not_found' },
    ]);
  });

  it('imports a PGN and a Lichess URL pasted together', async () => {
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ trees: [tree], failures: [] }),
      '/api/import/lichess': () => jsonResponse({ tree }),
    });

    const preview = await importAnything('1. e4 e5 *\nhttps://lichess.org/abc12345');

    expect(preview.trees).toHaveLength(2);
    expect(preview.source).toBe('mixed');
    expect(preview.skips).toEqual([]);
  });

  it('keeps the PGN skip when the PGN part fails but a URL imports', async () => {
    stubFetch({
      '/api/import/pgn': () => jsonResponse({ errors: { code: 'invalid_pgn' } }, 422),
      '/api/import/lichess': () => jsonResponse({ tree }),
    });

    const preview = await importAnything('not pgn\nhttps://lichess.org/abc12345');

    expect(preview.trees).toHaveLength(1);
    expect(preview.skips).toEqual([{ kind: 'pgn', code: 'invalid_pgn' }]);
  });

  it('throws the first error when nothing parses at all', async () => {
    stubFetch({
      '/api/import/lichess': () =>
        jsonResponse({ errors: { code: 'lichess_game_not_found' } }, 404),
    });

    await expect(importAnything('https://lichess.org/bad12345')).rejects.toMatchObject({
      code: 'lichess_game_not_found',
    });
  });
});
