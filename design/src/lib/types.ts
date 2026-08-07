import type { Role } from "./identity";

export interface MemberDto {
  userId: string;
  name: string;
  role: Role;
  lastSeen: string;
  cursorNodeId: number | null;
  online: boolean;
}

export interface GameDto {
  id: number;
  white: string;
  black: string;
  event: string;
  site: string | null;
  date: string | null;
  result: string;
  eco: string | null;
  opening: string | null;
  startFen: string;
  source: string;
  plies: number;
  nodeCount: number;
}

export interface NodeDto {
  id: number;
  parentId: number | null;
  ply: number;
  san: string;
  uci: string;
  fen: string;
  comment: string | null;
  authorName: string | null;
  orderIdx: number;
}

export interface ActivityDto {
  id: number;
  kind: "join" | "leave" | "move" | "comment" | "import" | "role" | "present";
  actorName: string;
  actorId: string;
  detail: string;
  createdAt: string;
}

export interface RoomState {
  room: {
    code: string;
    title: string;
    ownerId: string;
    presenterId: string | null;
    activeGameId: number | null;
    createdAt: string;
  };
  you: { id: string; name: string; role: Role };
  members: MemberDto[];
  games: GameDto[];
  nodes: NodeDto[];
  activity: ActivityDto[];
  version: number;
}
