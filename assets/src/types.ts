export type Meta = {
  phxRef: string;
  onlineAt: string;
};

export type User = {
  id: string;
  metas: Meta[];
};

export type Room = {
  roomCode: string;
  users: User[];
};

export type Square = {
  squareIndex: number;
  color: "dark" | "light";
  piece: "k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P" | null;
};

export type Game = {
  gameCode: string;
  squares: Square[];
};
