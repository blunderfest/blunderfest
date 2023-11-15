import { createReducer } from "@reduxjs/toolkit";
import { gameAdded, gameSwitched, userJoined, userLeft } from "./actions";

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
    .addCase(userJoined, (state, action) => {
      state.users.push(action.payload);
    })
    .addCase(userLeft, (state, action) => {
      state.users = state.users.filter((user) => user != action.payload);
    })
    .addCase(gameSwitched, (state, action) => {
      state.activeGame = action.payload;
    })
    .addCase(gameAdded, (state, action) => {
      state.games.push(action.payload.gameId);

      if (!state.activeGame) {
        state.activeGame = action.payload.gameId;
      }
    });
});
