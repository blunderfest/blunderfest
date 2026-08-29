import type { GameTree } from '@/lib/api';

/**
 * One derivation for a game's display title, shared by both games rails
 * (ADR-0032's chrome) and the report/export headers. Fallback order:
 *
 *   1. The custom `Title` header — set by the `rename_game` op. It rides
 *      the tree, so exports carry it. (Empty string clears it back to the
 *      derivations below.)
 *   2. Players: "White – Black" (either side alone works).
 *   3. Event (the library's fallback chain does the same — `library.ex`).
 *   4. The numbered fallback: knowing which untitled index this game is
 *      (its position among untitled games in the caller's enumeration)
 *      turns "Untitled game" into "Game N". Pass the full enumeration
 *      index in `untitledIndex`.
 */
export function gameTitle(tree: GameTree, untitled: string, untitledIndex = 1): string {
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
  return `${untitled} ${untitledIndex}`;
  // "Game" label lives in the caller's i18n key — this only appends N.
}
