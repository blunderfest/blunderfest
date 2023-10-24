import { createReducer } from "@reduxjs/toolkit";
import { addGame } from "../room";

/**
 * @type {{
 *   games: Record<string, Game>
 * }}
 */
const initialState = {
  games: {},
};

export const gameReducer = createReducer(initialState, (builder) => {
  builder.addCase(addGame, (state, action) => {
    state.games[action.payload.id] = action.payload;
  });
});
