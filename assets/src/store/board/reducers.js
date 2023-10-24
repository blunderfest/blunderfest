import { createReducer } from "@reduxjs/toolkit";
import { mark, reset, select } from "./actions";

/**
 * @type {Board}
 */
const initialState = {
  selectedSquare: null,
  marks: [...Array.from({ length: 64 }).fill("none")],
};

export const boardReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(select, (state, action) => {
      const { squareIndex } = action.payload;

      if (state.selectedSquare === squareIndex) {
        state.selectedSquare = null;
      } else {
        state.selectedSquare = squareIndex;
      }
    })
    .addCase(reset, () => {
      return initialState;
    })
    .addCase(mark, (state, action) => {
      const { squareIndex, mark } = action.payload;

      if (state.marks[squareIndex] === mark) {
        state.marks[squareIndex] = "none";
      } else {
        state.marks[squareIndex] = mark;
      }
    });
});
