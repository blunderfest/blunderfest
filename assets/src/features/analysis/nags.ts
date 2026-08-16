/**
 * NAG (numeric annotation glyph) display. Only the move-quality set gets a
 * glyph; any other code round-trips through import/export but renders
 * nothing in the move list.
 */
export const NAG_GLYPHS: Record<number, string> = {
  1: '!',
  2: '?',
  3: '!!',
  4: '??',
  5: '!?',
  6: '?!',
};

/** The quality glyphs, best to worst — the annotation editor's order. */
export const QUALITY_NAGS: { code: number; glyph: string }[] = [
  { code: 3, glyph: '!!' },
  { code: 1, glyph: '!' },
  { code: 5, glyph: '!?' },
  { code: 6, glyph: '?!' },
  { code: 2, glyph: '?' },
  { code: 4, glyph: '??' },
];

export function nagGlyph(code: number): string | null {
  return NAG_GLYPHS[code] ?? null;
}
