import { createReducer } from "@reduxjs/toolkit";
import { gameAdded, markSquare, pieceMoved, resetPosition } from "./actions";

/**
 * @type {{
 *   byPositionId: Record<string, Record<number, Mark>>
 * }}
 */
const initialState = {
  byPositionId: {},
};

export const markReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(markSquare, (state, action) => {
      const { mark, positionId, squareIndex } = action.payload;
      const marks = state.byPositionId[positionId];

      if (marks[squareIndex] === mark) {
        delete marks[squareIndex];
      } else {
        marks[squareIndex] = mark;
      }
    })
    .addCase(resetPosition, (state, action) => {
      state.byPositionId[action.payload] = {};
    })
    .addCase(gameAdded, (state, action) => {
      const positionId = action.payload.position.positionId;
      state.byPositionId[positionId] = {};
    })
    .addCase(pieceMoved, (state, action) => {
      const positionId = action.payload.variation.position.positionId;
      state.byPositionId[positionId] = {};
    });
});
