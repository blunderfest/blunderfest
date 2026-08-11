// Builds the opening book (lichess-org/chess-openings, CC0) into
// public/openings.json: a map from position key (placement + side +
// castling) to "ECO|Name". Keyed by position, not move order, so
// transpositions classify identically; when two book lines reach the same
// position, the longest (most specific) line wins. The en-passant field is
// deliberately excluded: FEN writers disagree on when to emit it, and it
// never changes an opening's name.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const source = new URL('../data/openings/', import.meta.url);
const target = new URL('../public/openings.json', import.meta.url);

const byEpd = new Map();
let failed = 0;

for (const letter of ['a', 'b', 'c', 'd', 'e']) {
  const tsv = readFileSync(new URL(`${letter}.tsv`, source), 'utf8');
  for (const line of tsv.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    const [eco, name, pgn] = trimmed.split('\t');
    try {
      const game = new Chess();
      game.loadPgn(pgn);
      const key = game
        .fen()
        .split(' ')
        .filter((_, i) => i !== 3 && i < 4)
        .join(' ');
      const plies = pgn.split(/\s+/).length;
      const existing = byEpd.get(key);
      if (existing === undefined || plies > existing.plies) {
        byEpd.set(key, { plies, value: `${eco}|${name}` });
      }
    } catch {
      failed += 1;
      console.warn(`unparseable book line: ${eco} ${name} (${pgn})`);
    }
  }
}

if (failed > 0) {
  throw new Error(`${failed} book lines failed to parse`);
}

mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
const entries = [...byEpd.entries()].map(([epd, { value }]) => [epd, value]);
writeFileSync(target, JSON.stringify(Object.fromEntries(entries)));
console.log(`openings.json written: ${entries.length} positions`);
