type Enumerate<N extends number, Acc extends number[] = []> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

type Range<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>;

export type Piece = "k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P";
export type SquareIndex = Range<0, 63>;
export type Color = "dark" | "light";
export type Square = {
  squareIndex: SquareIndex;
  color: Color;
  piece: Piece | null;
};

export type Game = {
  position: string;
  gameCode: string;
  squares: Square[];
};
