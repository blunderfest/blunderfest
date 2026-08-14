import type { Entry } from '@/features/analysis/nodeMap';
import type { GameNode } from '@/lib/api';

/**
 * Opening classification, client-side (like the WASM engine): a static
 * opening book (lichess-org/chess-openings, CC0) built into
 * `/openings.json` at build time and fetched once per session. Keyed by
 * position (EPD), so transpositions classify identically.
 */

export type Opening = { eco: string; name: string };
export type OpeningBook = Record<string, string>;

let bookPromise: Promise<OpeningBook> | null = null;

/** The opening book, fetched once per session; an empty book on failure. */
export function loadOpeningBook(): Promise<OpeningBook> {
  bookPromise ??= Promise.resolve()
    .then(() => fetch('/openings.json'))
    .then((response) => (response.ok ? (response.json() as Promise<OpeningBook>) : {}))
    .catch(() => ({}));
  return bookPromise;
}

/** Test seam: drop the cached book. */
export function resetOpeningBookCache(): void {
  bookPromise = null;
}

/**
 * The position key: placement + side + castling. The en-passant field is
 * deliberately excluded — FEN writers disagree on when to emit it (Echecs
 * always does, chess.js only when a capture is legal), and it never changes
 * an opening's name.
 */
function positionKey(fen: string | null): string | null {
  return fen === null
    ? null
    : fen
        .split(' ')
        .filter((_, i) => i !== 3 && i < 4)
        .join(' ');
}

/**
 * The opening of the viewed line: the deepest book position on the path
 * from the root to `node` — so the name refines going deeper and sticks
 * once the line leaves the book. Follows whatever line is being viewed
 * (mainline or a variation); setup nodes outside the book fall through to
 * their parent.
 */
export function classifyOpening(
  book: OpeningBook,
  byId: Map<number, Entry>,
  node: GameNode | null,
): Opening | null {
  let current = node;
  while (current !== null) {
    const key = positionKey(current.fen);
    if (key !== null) {
      const hit = book[key];
      if (hit !== undefined) {
        const sep = hit.indexOf('|');
        return { eco: hit.slice(0, sep), name: hit.slice(sep + 1) };
      }
    }
    current = byId.get(current.id)?.parent ?? null;
  }
  return null;
}

/** Whether this exact position is in the book (no ancestor fallback). */
export function isBookPosition(book: OpeningBook, fen: string | null): boolean {
  const key = positionKey(fen);
  return key !== null && book[key] !== undefined;
}

/**
 * The mainline ply where the game leaves the opening book — the first
 * non-book position after a run of book positions. Null when the game never
 * enters (a custom setup) or never leaves (a short theory line) the book.
 */
export function openingExitPly(book: OpeningBook, root: GameNode): number | null {
  let node: GameNode | null = root;
  let seenBook = false;
  while (node !== null) {
    if (isBookPosition(book, node.fen)) {
      seenBook = true;
    } else if (seenBook) {
      return node.ply;
    }
    node = node.children[0] ?? null;
  }
  return null;
}
