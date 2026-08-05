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
  payload: { tree: GameTree };
};

export type MoveAtPlyOp = OpBase & {
  type: 'move_at_ply';
  payload: { ply: number; san: string };
};

export type ReplaceLineOp = OpBase & {
  type: 'replace_line';
  payload: { ply: number; moves: string[] };
};

export type CommentAtPlyOp = OpBase & {
  type: 'comment_at_ply';
  payload: { ply: number; text: string };
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
  payload: { ply: number };
};

export type Op =
  | SetGameOp
  | MoveAtPlyOp
  | ReplaceLineOp
  | CommentAtPlyOp
  | AddArrowOp
  | AddHighlightOp
  | SetCursorOp;

export type PresenceMember = {
  id: string;
  name: string;
};
