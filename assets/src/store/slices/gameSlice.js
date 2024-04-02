import { createSlice } from "@reduxjs/toolkit";
import { joined } from "../actions/joined";

/**
 * @typedef {Object} State
 * @property {Record<string, Game>} gamesByCode
 */

/**
 * @type {State}
 */
const initialState = {
  gamesByCode: {},
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(joined, (state, action) => {
      state.gamesByCode = action.payload.gamesByCode;
    });
  },
});

export const gameReducer = gameSlice.reducer;
