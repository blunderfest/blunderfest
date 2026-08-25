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
 * Plans the "Add as variation" action for a historical candidate.
 *
 * Exact candidates share the viewed position, so their continuation is a
 * legal variation from it — a plain line. Every other candidate's
 * continuation only applies from the candidate's own position, so the plan
 * first attaches that position as a setup child of the current node and
 * then grafts the line onto it. Node ids are derived deterministically on
 * every client (max id + 1), so the follow-up line can address the setup
 * node before any echo arrives.
 *
 * Returns null when nothing can be added (no legal prefix resolved).
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
  if (args.exact) {
    const moves = sanLineToMoves(args.currentFen, args.sans);
    return moves.length === 0 ? null : { kind: 'line', parentId: args.currentId, moves };
  }

  const moves = sanLineToMoves(args.candidateFen, args.sans);

  if (moves.length === 0) {
    return null;
  }

  return {
    kind: 'setup_line',
    setup: { parentId: args.currentId, fen: args.candidateFen },
    line: { parentId: args.maxNodeId + 1, moves },
  };
}
