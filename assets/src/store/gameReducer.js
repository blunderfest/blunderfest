import { createEntityAdapter, createReducer } from "@reduxjs/toolkit";
import { gameAdded, pieceMoved } from "./actions";
import { selectPosition } from "./actions/selectPosition";

/**
 * @typedef {{gameCode: String, tags: Tag[], currentPositionId: String}} Game
 * @type {import("@reduxjs/toolkit").EntityAdapter<Game>}
 */
const gameAdapter = createEntityAdapter({
  selectId: (game) => game.gameCode,
});

export const gameReducer = createReducer(gameAdapter.getInitialState(), (builder) => {
  builder
    .addCase(gameAdded, (state, action) => {
      gameAdapter.addOne(state, {
        gameCode: action.payload.gameCode,
        currentPositionId: action.payload.position.positionId,
        tags: action.payload.tags,
      });
    })
    .addCase(pieceMoved, (state, action) => {
      gameAdapter.updateOne(state, {
        id: action.payload.gameCode,
        changes: {
          currentPositionId: action.payload.variation.position.positionId,
        },
      });
    })
    .addCase(selectPosition, (state, action) => {
      gameAdapter.updateOne(state, {
        id: action.payload.gameCode,
        changes: {
          currentPositionId: action.payload.positionId,
        },
      });
    });
});
