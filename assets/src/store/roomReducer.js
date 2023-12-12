import { createReducer } from "@reduxjs/toolkit";
import { gameAdded, gameSwitched } from "./actions";
import { presenceDiff } from "./actions/presenceDiff";
import { presenceState } from "./actions/presenceState";

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
    .addCase(presenceState, (state, action) => {
      const userIds = Object.keys(action.payload);

      state.users = userIds;
    })
    .addCase(presenceDiff, (state, action) => {
      const users = new Set(state.users);

      Object.keys(action.payload.joins).forEach((joined) => users.add(joined));
      Object.keys(action.payload.leaves).forEach((joined) => users.delete(joined));

      state.users = [...users];
    })
    .addCase(gameSwitched, (state, action) => {
      state.activeGame = action.payload.gameCode;
    })
    .addCase(gameAdded, (state, action) => {
      state.games.push(action.payload.gameCode);

      if (!state.activeGame) {
        state.activeGame = action.payload.gameCode;
      }
    });
});
