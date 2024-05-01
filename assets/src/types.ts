export type Piece = "k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P";

export type PieceColor = "black" | "white";

// prettier-ignore
export type SquareIndex =
   0 |  1 |  2 |  3 |  4 |  5 |  6 |  7 |  8 |  9
| 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 
| 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 
| 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 
| 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 
| 50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 
| 60 | 61 | 62 | 63;

export type Move = {
  from: SquareIndex;
  to: SquareIndex;
  promotion?: Piece;
  variationPath: number[];
};

export type Position = {
  pieces: Array<
    | {
        symbol: Piece;
      }
    | undefined
  >;
  activeColor: PieceColor;
  castlingAvailability: Array<[PieceColor, Piece]>;
  enPassant?: SquareIndex;
  halfmoveClock: number;
  fullmoveNumber: number;
};

export type Variation = {
  move?: Move;
  position: Position;
  variations: Variation[];
};

export type Game = {
  gameCode: string;
  startingPosition: Position;
  variations: Variation[];
};

export type Room = {
  roomCode: string;
  currentGame: string;
  games: Game[];
};
