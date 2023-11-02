import { createReducer } from "@reduxjs/toolkit";
import { addGame } from "../room";
import { moved } from "./actions";

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
    .addCase(moved, (state, action) => {
      const { gameId, move, fen, positionId, ply } = action.payload;
      const game = state.byId[gameId];
      const position = /** @type {Position} */ ({
        id: positionId,
        fen: fen,
        arrows: [],
        marks: [],
        ply: ply,
        selectedSquareIndex: 0,
      });

      const variation = /** @type {Variation} */ ({
        position: position,
        move: move,
        variations: [],
      });

      game.variations.push(variation);
    });
});
