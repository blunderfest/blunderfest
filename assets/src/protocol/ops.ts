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
  payload: { game_id: string; ply: number; text: string };
};

export type AddArrowOp = OpBase & {
  type: 'add_arrow';
  payload: { ply: number; from: string; to: string };
};

export type AddHighlightOp = OpBase & {
  type: 'add_highlight';
  payload: { ply: number; squares: string[] };
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

export type Op =
  | SetGameOp
  | SelectGameOp
  | MoveAtPlyOp
  | ReplaceLineOp
  | CommentAtPlyOp
  | AddArrowOp
  | AddHighlightOp
  | SetCursorOp
  | SetPositionOp;

export type PresenceMember = {
  id: string;
  name: string;
};

export type MemberRole = 'owner' | 'collaborator' | 'viewer';
