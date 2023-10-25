import { createReducer } from "@reduxjs/toolkit";
import { addGame } from "../room";
import { move } from "./actions";

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
  builder
    .addCase(addGame, (state, action) => {
      const game = action.payload;

      state.byId[game.id] = game;
      state.allIds.push(game.id);
    })
    .addCase(move, (state, action) => {
      const { gameId, variation } = action.payload;

      const game = state.byId[gameId];
      game.variations.push(variation);
    });
});
