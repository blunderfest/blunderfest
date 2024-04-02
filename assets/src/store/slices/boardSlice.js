import { createSlice } from "@reduxjs/toolkit";
import { joined } from "../actions/joined";

/**
 * @typedef {Object} State
 * @property {Square[]} squares
 */

/**
 * @type {State}
 */
const initialState = {
  squares: [],
};

/**
 * @param {string} fen
 */
function parseFen(fen) {
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

  return squares.map((piece, index) => ({
    squareIndex: index,
    piece: piece,
    color: ((index >> 3) ^ index) & 1 ? "light" : "dark",
  }));
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
