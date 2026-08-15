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
};

export type SetGameOp = OpBase & {
  type: 'set_game';
  payload: { game_id?: string; tree: GameTree };
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
 * A free-form position edit (ADR-0011): not a move — the resulting position,
 * however reached, as a FEN. Replays as a setup node under `parent_id`.
 */
export type SetPositionOp = OpBase & {
  type: 'set_position';
  payload: { game_id: string; parent_id: number; fen: string };
};

/**
 * A whole-game engine analysis (ADR-0009): appended by the server when a
 * job completes — one op carries every mainline eval. `score` is from
 * white's perspective; null when the engine couldn't evaluate that ply.
 * Terminal positions carry `result` instead of a number (a mated side has
 * no eval — "mate 0" would flip to the wrong winner).
 */
export type AnalysisEval = {
  ply: number;
  score: { cp?: number; mate?: number; result?: string } | null;
  best_move: string | null;
};

export type SetAnalysisOp = OpBase & {
  type: 'set_analysis';
  payload: { game_id: string; depth: number; evals: AnalysisEval[] };
};

export type Op =
  | SetGameOp
  | SelectGameOp
  | MoveAtPlyOp
  | ReplaceLineOp
  | CommentAtPlyOp
  | SetAnnotationsOp
  | SetCursorOp
  | SetPositionOp
  | SetAnalysisOp;

export type PresenceMember = {
  id: string;
  name: string;
};

export type MemberRole = 'owner' | 'collaborator' | 'viewer';
