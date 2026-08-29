import type { GameTree } from '@/lib/api';

/**
 * One derivation for a game's display title, shared by the games rail
 * (ADR-0032's chrome) and the report/export headers. Fallback order:
 *
 *   1. The custom `Title` header — set by the `rename_game` op or the
 *      auto-numbered name written at "New game" time. It rides the tree,
 *      so exports carry it.
 *   2. Players: "White – Black" (either side alone works).
 *   3. Event (the library's fallback chain does the same — `library.ex`).
 *   4. Plain "Untitled game" for headerless imports — the auto-numbering
 *      below only fires when creating a new game.
 */
export function gameTitle(tree: GameTree, untitled: string): string {
  const named = tree.headers.Title?.trim();
  if (named) {
    return named;
  }
  const white = tree.headers.White;
  const black = tree.headers.Black;
  if (white || black) {
    return white && black ? `${white} – ${black}` : (white ?? black ?? '');
  }
  const event = tree.headers.Event?.trim();
  if (event) {
    return event;
  }
  return untitled;
}
