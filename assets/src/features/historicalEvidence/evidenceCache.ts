import { sanLineToMoves } from '@/features/analysis/legalMoves';
import type { HistoricalEvidenceResult } from '@/features/historicalEvidence/types';
import type { LegalMove } from '@/lib/api';

/**
 * Resolved SAN→moves lines, keyed by FEN + SAN list. The resolution
 * (chess.js legal-move generation) is deterministic per input and the
 * expensive part of the variation button's state check — which runs for
 * every candidate whenever the dialog lands on a result. Caching it keeps
 * re-landings cheap; the cap bounds memory.
 */
const MOVES_CACHE = new Map<string, LegalMove[]>();
const MOVES_CACHE_LIMIT = 200;

export function resolvedLineMoves(fen: string, sans: string[]): LegalMove[] {
  const key = `${fen}\n${sans.join(' ')}`;
  const cached = MOVES_CACHE.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const moves = sanLineToMoves(fen, sans);
  MOVES_CACHE.set(key, moves);
  if (MOVES_CACHE.size > MOVES_CACHE_LIMIT) {
    const oldest = MOVES_CACHE.keys().next().value;
    if (oldest !== undefined) {
      MOVES_CACHE.delete(oldest);
    }
  }
  return moves;
}

/**
 * Finished analyses, keyed by their request (position + route + ply), kept
 * for the session. The dialog unmounts on close — without this, reopening
 * it for the same position would throw a finished analysis away and force
 * a re-run. A re-run always re-fetches (the corpus may change between
 * deploys); the cache only restores the last result for a position.
 */
const RESULT_CACHE = new Map<string, HistoricalEvidenceResult>();
const RESULT_CACHE_LIMIT = 20;

export function requestKey(fen: string, route: string[] | null, refPly: number | null): string {
  return JSON.stringify([fen, route ?? null, refPly ?? null]);
}

export function cachedResult(key: string): HistoricalEvidenceResult | undefined {
  return RESULT_CACHE.get(key);
}

export function rememberResult(key: string, result: HistoricalEvidenceResult): void {
  RESULT_CACHE.set(key, result);
  if (RESULT_CACHE.size > RESULT_CACHE_LIMIT) {
    const oldest = RESULT_CACHE.keys().next().value;
    if (oldest !== undefined) {
      RESULT_CACHE.delete(oldest);
    }
  }
}

/** Clears remembered results and resolved lines (tests). */
export function resetHistoricalEvidenceCache(): void {
  RESULT_CACHE.clear();
  MOVES_CACHE.clear();
}
