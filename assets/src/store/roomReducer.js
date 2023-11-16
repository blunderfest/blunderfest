import { createReducer } from "@reduxjs/toolkit";
import { gameAdded, gameSwitched, userJoined, userLeft } from "./actions";
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
      const joined = Object.keys(action.payload.joins);
      const left = Object.keys(action.payload.leaves);

      joined.forEach((userId) => state.users.push(userId));
      left.forEach((userId) => state.users.filter((user) => user != userId));
    })
    .addCase(userJoined, (state, action) => {
      state.users.push(action.payload);
    })
    .addCase(userLeft, (state, action) => {
      state.users = state.users.filter((user) => user != action.payload.userId);
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
