import { ApiError, type GameTree, importLichess, importPgn } from '@/lib/api';

/** What got skipped in an import, with enough context to report it. */
export type ImportSkip =
  | { kind: 'pgnGame'; index: number; detail: { reason: string; san?: string; ply?: number } }
  | { kind: 'pgn'; code: string }
  | { kind: 'lichess'; url: string; code: string };

export type ImportPreview = {
  trees: GameTree[];
  skips: ImportSkip[];
  source: 'pgn' | 'lichess' | 'mixed';
};

const LICHESS_LINE = 'https://lichess.org';

/**
 * Splits the import box into Lichess URLs and PGN text, line by line: a
 * line that starts with `https://lichess.org` goes to Lichess, everything
 * else is PGN. Line-level splitting keeps PGN comments and movetext intact
 * (a URL inside a {comment} stays a comment) and allows any mixture:
 * several URLs, one URL and a PGN, just PGNs.
 */
export function splitImportInput(input: string): { pgn: string | null; lichessUrls: string[] } {
  const lichessUrls: string[] = [];
  const pgnLines: string[] = [];
  for (const line of input.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith(LICHESS_LINE)) {
      lichessUrls.push(trimmed);
    } else {
      pgnLines.push(line);
    }
  }
  const pgn = pgnLines.join('\n');
  return { pgn: pgn.trim() === '' ? null : pgn, lichessUrls };
}

/**
 * Imports whatever the box holds: the PGN part via the multi-game parser,
 * then each Lichess URL in turn (sequential — Lichess throttles concurrent
 * exports per client IP). Resolves with the games that made it plus the
 * skips; rejects with the first error only when nothing parsed at all, so
 * the dialog can keep its all-or-nothing error box for that case.
 */
export async function importAnything(input: string): Promise<ImportPreview> {
  const { pgn, lichessUrls } = splitImportInput(input);
  const trees: GameTree[] = [];
  const skips: ImportSkip[] = [];
  let firstError: ApiError | null = null;

  if (pgn !== null) {
    try {
      const result = await importPgn(pgn);
      trees.push(...result.trees);
      for (const failure of result.failures) {
        skips.push({ kind: 'pgnGame', index: failure.index, detail: failure.detail });
      }
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('unknown');
      firstError = apiError;
      skips.push({ kind: 'pgn', code: apiError.code });
    }
  }

  for (const url of lichessUrls) {
    try {
      const { tree } = await importLichess(url);
      trees.push(tree);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('unknown');
      firstError ??= apiError;
      skips.push({ kind: 'lichess', url, code: apiError.code });
    }
  }

  if (trees.length === 0 && firstError !== null) {
    throw firstError;
  }

  const source = pgn !== null ? (lichessUrls.length > 0 ? 'mixed' : 'pgn') : 'lichess';
  return { trees, skips, source };
}
