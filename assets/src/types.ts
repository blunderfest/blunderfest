export interface Meta {
  phxRef: string;
  onlineAt: string;
}

export interface User {
  id: string;
  metas: Meta[];
}

export interface Room {
  roomCode: string;
  timestamp: number;
  users: User[];
}
