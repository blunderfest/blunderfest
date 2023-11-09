import { createReducer } from "@reduxjs/toolkit";
import { gameAdded, gameSwitched, joined, left } from "./actions";

/**
 * @type {{
 *   users: string[],
 *   games: string[],
 *   activeGame?: string,
 * }}
 */
const initialState = {
  users: [],
  games: [],
  activeGame: "",
};

export const roomReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(joined, (state, action) => {
      state.users.push(action.payload);
    })
    .addCase(left, (state, action) => {
      state.users = state.users.filter((user) => user != action.payload);
    })
    .addCase(gameSwitched, (state, action) => {
      state.activeGame = action.payload;
    })
    .addCase(gameAdded, (state, action) => {
      state.games.push(action.payload.id);

      if (!state.activeGame) {
        state.activeGame = action.payload.id;
      }
    });
});
