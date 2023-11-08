import { createReducer } from "@reduxjs/toolkit";
import { moved } from "../games";
import { reset } from "../positions";
import { addGame } from "../room";
import { mark } from "./actions";

/**
 * @type {{
 *   byPositionId: Record<string, Record<number, Mark>>
 * }}
 */
const initialState = {
  byPositionId: {},
};

export const marksReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(mark, (state, action) => {
      const { mark, positionId, squareIndex } = action.payload;
      const marks = state.byPositionId[positionId];

      if (marks[squareIndex] === mark) {
        delete marks[squareIndex];
      } else {
        marks[squareIndex] = mark;
      }
    })
    .addCase(reset, (state, action) => {
      const { positionId } = action.payload;
      state.byPositionId[positionId] = {};
    })
    .addCase(addGame, (state, action) => {
      const positionId = action.payload.position.id;
      state.byPositionId[positionId] = {};
    })
    .addCase(moved, (state, action) => {
      const { positionId } = action.payload;
      state.byPositionId[positionId] = {};
    });
});
