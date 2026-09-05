import { useEffect, useState } from 'react';
import { type BookMove, fetchBook } from '@/lib/api';

/** The per-fen corpus book cache — module-scoped, so cursor revisits are free. */
const statsCache = new Map<string, BookMove[]>();

/** Test seam: drop the cached corpus book stats. */
export function resetBookStatsCache(): void {
  statsCache.clear();
}

/** The corpus next-move stats fetch state for the rendered position. */
export type CorpusBookStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; moves: BookMove[] }
  | { kind: 'failed' };

/**
 * The corpus opening-book stats for a position (`GET /api/book?fen=…`) —
 * one fetch per FEN, module-cached. Lifted above both consumers of the
 * Positional Context panel: the row rendering (ReferencePanel) and the
 * panel's resolution ladder (corpus rows lead; the named book labels).
 */
export function useCorpusBook(fen: string | null): CorpusBookStatus {
  const [status, setStatus] = useState<CorpusBookStatus>(() => {
    if (fen === null) {
      return { kind: 'ready', moves: [] };
    }
    const cached = statsCache.get(fen);
    return cached !== undefined ? { kind: 'ready', moves: cached } : { kind: 'loading' };
  });

  // A position change resets to loading unless the stats are cached —
  // render-time compare (adjust-state-during-render) avoids an effect round.
  const [previousFen, setPreviousFen] = useState<string | null>(fen);
  if (previousFen !== fen) {
    setPreviousFen(fen);
    if (fen === null) {
      setStatus({ kind: 'ready', moves: [] });
    } else {
      const cached = statsCache.get(fen);
      setStatus(cached !== undefined ? { kind: 'ready', moves: cached } : { kind: 'loading' });
    }
  }

  useEffect(() => {
    if (fen === null) {
      return;
    }
    if (statsCache.get(fen) !== undefined) {
      return;
    }
    let cancelled = false;
    fetchBook(fen)
      .then(({ moves }) => {
        if (!cancelled) {
          // Defensive: a malformed response (no moves array) reads as an
          // empty corpus verdict, never a crash — the panel's ladder falls
          // through to the legacy branches.
          const list = Array.isArray(moves) ? moves : [];
          statsCache.set(fen, list);
          setStatus({ kind: 'ready', moves: list });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ kind: 'failed' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fen]);

  return status;
}
