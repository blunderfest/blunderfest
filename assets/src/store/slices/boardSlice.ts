import { createSlice } from "@reduxjs/toolkit";
import { joined } from "./connectivitySlice";

const knownPieces = ["k", "K", "q", "Q", "r", "R", "b", "B", "n", "N", "p", "P"] as const;
type KnownPieces = (typeof knownPieces)[number];

function isKnownPiece(piece: string): piece is KnownPieces {
  return knownPieces.includes(piece as KnownPieces);
}

type Square = {
  squareIndex: number;
  piece: (typeof knownPieces)[number] | null;
};

type State = {
  squares: Square[];
};

const initialState: State = {
  squares: [],
};

function parseFen(fen: string) {
  // , active_color, castling_availability, en_passant, ...rest
  const [pieces] = fen.split(" ");
  const squares = pieces
    .split("/")
    .reverse()
    .flatMap((row) =>
      row.split("").flatMap((piece) => {
        if (isNaN(+piece) && isKnownPiece(piece)) {
          return [piece];
        }

        return Array.from({ length: +piece }, () => null);
      })
    );

  return squares.map((piece, index) => ({
    squareIndex: index,
    piece: piece,
  }));
}

const boardSlice = createSlice({
  name: "board",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(joined, (state, action) => {
      const squares = parseFen(action.payload.gamesByCode[action.payload.activeGame].position);
      state.squares = squares;
    });
  },
});

export const boardReducer = boardSlice.reducer;
