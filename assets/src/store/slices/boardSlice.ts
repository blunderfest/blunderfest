import { joined } from "@/actions/joined";
import { Piece, Square, SquareIndex } from "@/types/Piece";
import { createSlice } from "@reduxjs/toolkit";

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
        if (isNaN(+piece)) {
          return [piece];
        }

        return Array.from({ length: +piece }, () => null);
      })
    );

  return squares.map(
    (piece, index): Square => ({
      squareIndex: index as SquareIndex,
      piece: piece as Piece,
      color: ((index >> 3) ^ index) & 1 ? "light" : "dark",
    })
  );
}

const boardSlice = createSlice({
  name: "board",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(joined, (state, action) => {
      const squares = parseFen(action.payload.gamesByCode[action.payload.activeGame].variations[0].position);
      state.squares = squares;
    });
  },
});

export const boardReducer = boardSlice.reducer;
