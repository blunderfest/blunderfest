import { legalMovesFor } from '@/features/analysis/legalMoves';
import { type Opening, type OpeningBook, openingAt } from '@/features/analysis/openings';
import type { BookMove, LegalMove } from '@/lib/api';

/**
 * The corpus layer of the Positional Context panel. The static opening book
 * is a sparse, leaf-keyed set (each named line keyed only at its final
 * position), so exact-key membership flickers ply by ply even along a named
 * line. The corpus book (`GET /api/book?fen=…`) is keyed by position like
 * the corpus itself and covers far more of the game — so it leads the panel,
 * with the named book demoted to a labeling layer on its rows.
 */

/**
 * Strip annotation glyphs (`!`, `?`, `!!`, `??`, `!?`, `?!`) from a corpus
 * SAN. Corpus SANs are stored as played, annotations included ("Bg4?!"),
 * while chess.js emits clean SANs — normalization makes the two meet.
 */
export function normalizeSan(san: string): string {
  return san.replace(/[!?]+$/, '');
}

/**
 * Corpus rows merged into clean next moves. The corpus stores SANs as
 * played, so one logical move can span several annotated rows ("Bg4" beside
 * "Bg4?!"); counts are summed per move. Sorted by games desc, then SAN.
 */
export function mergeCorpusMoves(moves: BookMove[]): BookMove[] {
  const merged = new Map<string, BookMove>();
  for (const move of moves) {
    const san = normalizeSan(move.move);
    const existing = merged.get(san);
    if (existing === undefined) {
      merged.set(san, { ...move, move: san });
    } else {
      existing.games += move.games;
      existing.white += move.white;
      existing.draw += move.draw;
      existing.black += move.black;
    }
  }
  return [...merged.values()].sort((a, b) => b.games - a.games || a.move.localeCompare(b.move));
}

/**
 * A corpus next move resolved to a playable move: the stats ride along, and
 * the named book labels the row when it keys the resulting position.
 */
export type CorpusContinuation = LegalMove & { stats: BookMove; opening: Opening | null };

/**
 * The corpus continuations from a position: merged corpus rows joined with
 * local legality (the ghost preview and click-to-play need from/to), each
 * carrying the opening name when the named book keys the resulting position.
 * Rows that don't resolve to a legal move are dropped — corpus moves were
 * played from the position, so in practice none do.
 */
export function corpusContinuationsFor(
  book: OpeningBook | null,
  fen: string | null,
  mergedMoves: BookMove[],
): CorpusContinuation[] {
  if (fen === null || mergedMoves.length === 0) {
    return [];
  }
  const legal = legalMovesFor(fen);
  const rows: CorpusContinuation[] = [];
  for (const stats of mergedMoves) {
    const move = legal.find((candidate) => candidate.san === stats.move);
    if (move !== undefined) {
      rows.push({ ...move, stats, opening: openingAt(book, move.fen) });
    }
  }
  return rows;
}
