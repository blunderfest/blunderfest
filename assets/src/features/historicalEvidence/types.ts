/**
 * The historical-evidence API contract (docs: historical-evidence vertical
 * slice). Mirrors the backend DTO — structured facts only, no relevance
 * score: the client owns the presentation.
 */

export type TypedDiff = {
  type: string;
  detail: string;
};

export type FamilyMember = {
  moves: string[];
  occurrences: number;
  /** Per-side plan actions (the skeleton tokenization), so the UI can
   * show what a plan is instead of just its id. */
  white: string[];
  black: string[];
};

export type PlanSide = {
  white: string[];
  black: string[];
};

export type FamilySummary = {
  id: number;
  occurrences: number;
  games: number;
  singleton: boolean;
  members: FamilyMember[];
};

export type GameMeta = {
  gid: number;
  white: string;
  black: string;
  result: string;
  date: string;
  eco: string;
  opening: string;
  white_elo: number | null;
  black_elo: number | null;
  event: string;
  time_control: string;
  site: string;
};

export type PositionDims = {
  pawn_structure: 'same' | [string, number];
  material: 'same' | [string, string];
  piece_placement: { matches: number; mismatches: number; ref_pieces: number };
  king_position: 'same' | [string, number];
  side_to_move: 'same' | 'differs';
  castling: 'same' | [string, string, string];
};

export type RouteInfo = {
  shared_plies: number;
  /** Null when the analysis ran on a bare FEN (no reference route). */
  ref_ply: number | null;
  diverged_ply: number | null;
  ref_move: string | null;
  cand_move: string | null;
  ply_gap: number;
  extra_white: string[];
  extra_black: string[];
  missing_white: string[];
  missing_black: string[];
};

export type FamilyMembership = {
  status: 'member' | 'none' | 'no_menu';
  member_of: number | null;
  sim: number | null;
  family_occurrences: number | null;
  family_games: number | null;
};

export type SideMembership = {
  status: 'member' | 'none' | 'no_menu';
  family_id: number | null;
  sim: number | null;
  family_occurrences: number | null;
  family_games: number | null;
};

export type EvidenceCandidate = {
  id: string;
  strategy: 'exact' | 'pawn_skeleton';
  /** The candidate position's side to move (for the per-side move split). */
  stm: 'w' | 'b';
  fen: string;
  gid: number;
  ply: number;
  game: GameMeta;
  position: {
    dims: PositionDims;
    differences: TypedDiff[];
  };
  route: RouteInfo;
  continuation: {
    moves: string[];
    differences: TypedDiff[];
  };
  families: {
    membership: FamilyMembership;
    skeleton: {
      white: SideMembership;
      black: SideMembership;
    };
  };
  historical: {
    occurrences: number;
    games: number;
    same_game_only: boolean;
  };
  flags: string[];
};

export type NextMoveRow = {
  move: string;
  /** Independent games that played this move next (never raw occurrences). */
  games: number;
};

export type HistoricalEvidenceResult = {
  reference: {
    fen: string;
    occurrences: number;
    games: number;
    families: FamilySummary[];
    next_moves: NextMoveRow[];
  };
  candidates: EvidenceCandidate[];
  timings: {
    candidates_ms: number;
    menu_ms: number;
    evidence_ms: number;
    total_ms: number;
  };
};
