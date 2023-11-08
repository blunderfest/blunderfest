import { createSlice } from "@reduxjs/toolkit";
import { moved } from "./gameSlice";
import { reset } from "./positionSlice";
import { gameAdded } from "./roomSlice";

/**
 * @type {{
 *   byPositionId: Record<string, Record<number, Mark>>
 * }}
 */
const initialState = {
  byPositionId: {},
};

const markSlice = createSlice({
  name: "mark",
  initialState,
  reducers: {
    marked: (state, /** @type {PayloadAction<{positionId: String, squareIndex: Number, mark: Mark}>} */ action) => {
      const { mark, positionId, squareIndex } = action.payload;
      const marks = state.byPositionId[positionId];

      if (marks[squareIndex] === mark) {
        delete marks[squareIndex];
      } else {
        marks[squareIndex] = mark;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(reset, (state, action) => {
        state.byPositionId[action.payload] = {};
      })
      .addCase(gameAdded, (state, action) => {
        const positionId = action.payload.position.id;
        state.byPositionId[positionId] = {};
      })
      .addCase(moved, (state, action) => {
        const { positionId } = action.payload;
        state.byPositionId[positionId] = {};
      });
  },
});

export const { marked } = markSlice.actions;
export const marksReducer = markSlice.reducer;
