import { createReducer } from "@reduxjs/toolkit";
import { addGame } from "../room";

/**
 * @type {{
 *   byId: Record<string, Game>,
 *   allIds: string[]
 * }}
 */
const initialState = {
  byId: {},
  allIds: [],
};

export const gameReducer = createReducer(initialState, (builder) => {
  builder.addCase(addGame, (state, action) => {
    const { id } = action.payload;

    state.byId[id] = action.payload;
    state.allIds.push(id);
  });
});
