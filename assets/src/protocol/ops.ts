/**
 * Room operations, mirrored from the Phoenix channel protocol.
 *
 * The server's authoritative state is the room's operation log; clients
 * replay ops on join and subscribe to new ones. These types are the client
 * side of that protocol — one source of truth shared by the socket handlers,
 * the store, and tests.
 */
import type { GameTree } from '@/lib/api';

export type OpBase = {
  seq: number;
  author: string;
  ts: string;
  /**
   * The display-name snapshot attached by the durable mirror (ADR-0028) —
   * present on ops replayed after a room reload, so history resolves
   * names even before presence refills.
   */
  author_name?: string;
};

export type SetGameOp = OpBase & {
  type: 'set_game';
  payload: {
    game_id?: string;
    tree: GameTree;
    /**
     * The corpus game id when the import came from the Examples dialog —
     * lets every client derive which candidates are already in the room.
     */
    evidence_gid?: number;
  };
};

export type SelectGameOp = OpBase & {
  type: 'select_game';
  payload: { game_id: string };
};

export type MoveAtPlyOp = OpBase & {
  type: 'move_at_ply';
  payload: {
    game_id: string;
    ply: number;
    san: string;
    from: string;
    to: string;
    promotion: string | null;
    fen: string;
    status: string;
    /**
     * The node this move extends. Node ids are derived deterministically
     * (max id + 1) on every client, so the id addresses variation parents
     * unambiguously — ply alone cannot (every node at a ply shares it).
     * Absent in logs from before variations were playable; those resolve the
     * mainline parent by ply.
     */
    parent_id?: number;
  };
};

export type ReplaceLineOp = OpBase & {
  type: 'replace_line';
  payload: { ply: number; moves: string[] };
};

/**
 * A whole line inserted under a node in one op (e.g. an engine line as a
 * variation): atomic, so no client has to predict derived node ids for a
 * chain of moves. Clients dedupe against existing children (same
 * from/to/promotion) — a line that starts with the already-played move
 * descends into it instead of duplicating it.
 */
export type AddLineOp = OpBase & {
  type: 'add_line';
  payload: {
    game_id: string;
    parent_id: number;
    moves: {
      san: string;
      from: string;
      to: string;
      promotion: string | null;
      fen: string;
      status: string;
    }[];
  };
};

export type CommentAtPlyOp = OpBase & {
  type: 'comment_at_ply';
  payload: {
    game_id: string;
    ply: number;
    text: string;
    /**
     * The node this comment belongs to. Ply alone only addresses mainline
     * moves — variation and setup nodes need the deterministic node id.
     * Absent in logs from before variation comments; those resolve the
     * mainline node by ply.
     */
    node_id?: number;
  };
};

export type DrawnArrow = { from: string; to: string; color: string };
export type DrawnHighlight = { square: string; color: string };

/**
 * Board annotations (arrows and square highlights) for one node, broadcast
 * and replayed for everyone (ADR-0005's "co-thinking" layer). Each op carries
 * the node's complete new sets — replay is a plain replace, no accumulation.
 */
export type SetAnnotationsOp = OpBase & {
  type: 'set_annotations';
  payload: {
    game_id: string;
    node_id: number;
    arrows: DrawnArrow[];
    highlights: DrawnHighlight[];
  };
};

export type SetCursorOp = OpBase & {
  type: 'set_cursor';
  payload: { node_id: number };
};

/**
 * A node's NAGs (numeric annotation glyphs, `$1`.. in PGN), full-replace
 * like `set_annotations`. Only the move-quality set ($1 !$2 ? $3 !! $4 ??
 * $5 !? $6 ?!) gets UI; any code round-trips through import/export.
 */
export type SetNagsOp = OpBase & {
  type: 'set_nags';
  payload: { game_id: string; node_id: number; nags: number[] };
};

/**
 * A room chat message. Chat rides the op log like everything else
 * (ADR-0005): replay on join gives history for free, seq ordering is the
 * shared truth, and no second sync channel exists. Not an edit op, but
 * posting needs edit rights — owners and collaborators chat, viewers
 * read along (ADR-0023). Read-only rooms reject it like all ops.
 */
export type ChatOp = OpBase & {
  type: 'chat';
  payload: { text: string };
};

/**
 * Chat moderation (ADR-0023): the owner deletes a message by its op seq.
 * The original chat op stays in the log — deletion is a filter every
 * client applies on top, so replay hides the message too.
 */
export type DeleteChatOp = OpBase & {
  type: 'delete_chat';
  payload: { seq: number };
};

/**
 * A free-form position edit (ADR-0011): not a move — the resulting position,
 * however reached, as a FEN. Replays as a setup node under `parent_id`.
 */
export type SetPositionOp = OpBase & {
  type: 'set_position';
  payload: { game_id: string; parent_id: number; fen: string };
};

/**
 * A whole-game engine analysis (ADR-0009): appended by the server when a
 * job completes — one op carries every evaluated position. `score` is from
 * white's perspective; null when the engine couldn't evaluate that ply.
 * Terminal positions carry `result` instead of a number (a mated side has
 * no eval — "mate 0" would flip to the wrong winner).
 *
 * `node_id` is the deterministic tree id of the evaluated node; present
 * since analyses went node-keyed (variation lines), absent in legacy
 * mainline-only logs. Multiple `set_analysis` ops for a game merge per
 * node (re-runs override; a line analysis adds its nodes).
 */
export type AnalysisEval = {
  ply: number;
  score: { cp?: number; mate?: number; result?: string } | null;
  best_move: string | null;
  /** The evaluated node (present in node-keyed analyses; absent in legacy logs). */
  node_id?: number;
};

/**
 * A position submitted for server-side analysis (`analyze_game`):
 * the mainline for whole-game (re-)analysis, an off-mainline segment for
 * "Analyze line". `node_id` rides through to the eval entries — the merge
 * key on clients (legacy jobs leave it out).
 */
export type AnalysisPosition = { ply: number; fen: string; node_id?: number };

export type SetAnalysisOp = OpBase & {
  type: 'set_analysis';
  payload: { game_id: string; depth: number; evals: AnalysisEval[] };
};

export type Op =
  | SetGameOp
  | SelectGameOp
  | MoveAtPlyOp
  | ReplaceLineOp
  | AddLineOp
  | CommentAtPlyOp
  | SetAnnotationsOp
  | SetCursorOp
  | SetNagsOp
  | SetPositionOp
  | SetAnalysisOp
  | ChatOp
  | DeleteChatOp;

export type PresenceMember = {
  id: string;
  name: string;
};

export type MemberRole = 'owner' | 'collaborator' | 'viewer';
