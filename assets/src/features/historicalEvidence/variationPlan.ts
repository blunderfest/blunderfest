import { sanLineToMoves } from '@/features/analysis/legalMoves';
import type { LegalMove } from '@/lib/api';

export type VariationPlan =
  | { kind: 'line'; parentId: number; moves: LegalMove[] }
  | {
      kind: 'setup_line';
      setup: { parentId: number; fen: string };
      line: { parentId: number; moves: LegalMove[] };
    };

/**
 * Plans the "Add as variation" action from SANs — resolving them with
 * chess.js. Used on the click path, where one resolution per add is fine.
 * The button-state check uses `planFromResolvedMoves/1` instead: the
 * SAN→moves resolution is the expensive part, and the state check runs
 * for every candidate on every landing, so callers resolve once and
 * cache (the resolution is deterministic per FEN + SAN list).
 */
export function planHistoricalVariation(args: {
  /** The candidate position equals the viewed one (exact retrieval). */
  exact: boolean;
  /** The viewed node's id (the variation parent). */
  currentId: number;
  /** The tree's largest node id (the setup child will be `max + 1`). */
  maxNodeId: number;
  currentFen: string;
  candidateFen: string;
  sans: string[];
}): VariationPlan | null {
  const moves = args.exact
    ? sanLineToMoves(args.currentFen, args.sans)
    : sanLineToMoves(args.candidateFen, args.sans);
  return planFromResolvedMoves({
    exact: args.exact,
    currentId: args.currentId,
    maxNodeId: args.maxNodeId,
    candidateFen: args.candidateFen,
    moves,
  });
}

/**
 * The same plan, from pre-resolved moves (no chess.js here). Empty or
 * unresolved lines yield null — there is nothing to add.
 */
export function planFromResolvedMoves(args: {
  exact: boolean;
  currentId: number;
  maxNodeId: number;
  candidateFen: string;
  moves: LegalMove[];
}): VariationPlan | null {
  if (args.moves.length === 0) {
    return null;
  }

  if (args.exact) {
    return { kind: 'line', parentId: args.currentId, moves: args.moves };
  }

  return {
    kind: 'setup_line',
    setup: { parentId: args.currentId, fen: args.candidateFen },
    line: { parentId: args.maxNodeId + 1, moves: args.moves },
  };
}
