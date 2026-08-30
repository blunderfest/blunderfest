import { type PieceKind, parseFen } from '@/components/board';
import type { GameNode } from '@/lib/api';

/** Piece values for the phase score: queens 4, rooks 2, bishops/knights 1, pawns 1. */
const PHASE_VALUES: Record<PieceKind, number> = { q: 4, r: 2, b: 1, n: 1, p: 1, k: 0 };

/** The phase score's full-board reference: 24 (16 pawns + 8 pieces, both sides). */
const PHASE_MAX = 24;

/**
 * A position's phase (the positional-context panel + the eval chart's
 * endgame shading, unified). The material phase is a continuous 0..1 score
 * (the standard game-phase model): 1.0 is the full board, 0.0 is bare
 * kings. Tablebase eligibility is the Syzygy predicate (≤ 7 pieces).
 * "Likely endgame" is the 0.5 band — see the resolution order in
 * `PositionContext`.
 */
export type PositionPhase = {
  /** 0..1 — remaining material / 24 (pawns included; the tablebase counts them). */
  materialPhase: number;
  /** Non-king pieces on the board. */
  pieceCount: number;
  /** Syzygy eligibility (≤ 7 pieces). */
  tablebaseEligible: boolean;
  /** materialPhase <= 0.5. */
  likelyEndgame: boolean;
};

/** The phase of a parsed position. */
export function phaseOfPosition(position: ReturnType<typeof parseFen>): PositionPhase {
  let remaining = 0;
  let pieceCount = 0;
  for (const piece of position) {
    if (piece !== null && piece.kind !== 'k') {
      remaining += PHASE_VALUES[piece.kind];
      pieceCount += 1;
    }
  }
  const materialPhase = Math.min(remaining / PHASE_MAX, 1);
  return {
    materialPhase,
    pieceCount,
    tablebaseEligible: pieceCount <= 7,
    likelyEndgame: materialPhase <= 0.5,
  };
}

/** The phase of a FEN. */
export function phaseOf(fen: string): PositionPhase {
  return phaseOfPosition(parseFen(fen));
}

/**
 * Whether a FEN is an endgame position — the phase model's `likelyEndgame`
 * band, shared with the panel (the positional-context panel's endgame
 * hook).
 */
export function isEndgameFen(fen: string): boolean {
  return phaseOf(fen).likelyEndgame;
}

/**
 * Where the endgame began, for the eval chart's phase shading
 * (visualization ideas #1). The earliest ply of the closing stretch in
 * which every position is in the likely-endgame band — the *closing*
 * stretch, because promotions can bring material back, so a mid-game dip
 * doesn't shade as an endgame that then un-happens. Pure tree data (FENs);
 * null when the game stays a middlegame, 0 when it starts as an endgame
 * (e.g. a free-form setup).
 */
export function endgameStart(root: GameNode): number | null {
  const mainline: { ply: number; endgame: boolean }[] = [];
  let node: GameNode | null = root;
  while (node !== null) {
    if (node.fen !== null) {
      mainline.push({ ply: node.ply, endgame: phaseOf(node.fen).likelyEndgame });
    }
    node = node.children[0] ?? null;
  }

  let start: number | null = null;
  for (let i = mainline.length - 1; i >= 0; i--) {
    if (!mainline[i].endgame) {
      break;
    }
    start = mainline[i].ply;
  }
  return start;
}
