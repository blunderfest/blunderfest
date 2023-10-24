import { createReducer } from "@reduxjs/toolkit";
import { addGame, join, leave, switchGame } from "./actions";

/**
 * @type {{
 *   users: string[],
 *   games: string[],
 *   activeGame: string
 * }}
 */
const initialState = {
  users: [],
  games: [],
  activeGame: "",
};

export const roomReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(join, (state, action) => {
      const { userId } = action.payload;

      state.users.push(userId);
    })
    .addCase(leave, (state, action) => {
      const { userId } = action.payload;

      state.users = state.users.filter((user) => user != userId);
    })
    .addCase(switchGame, (state, action) => {
      const { id } = action.payload;

      state.activeGame = id;
    })
    .addCase(addGame, (state, action) => {
      const { id } = action.payload;

      state.games.push(id);
      if (!state.activeGame) {
        state.activeGame = id;
      }
    });
});
