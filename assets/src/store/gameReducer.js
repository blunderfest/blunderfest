import { createEntityAdapter, createReducer } from "@reduxjs/toolkit";
import { gameAdded, pieceMoved } from "./actions";

/**
 * @typedef {{id: String, tags: Tag[], currentPositionId: String}} Game
 * @type {import("@reduxjs/toolkit").EntityAdapter<Game>}
 */
const gameAdapter = createEntityAdapter();

export const gameReducer = createReducer(gameAdapter.getInitialState(), (builder) => {
  builder
    .addCase(gameAdded, (state, action) => {
      gameAdapter.addOne(state, {
        id: action.payload.id,
        currentPositionId: action.payload.position.id,
        tags: action.payload.tags,
      });
    })
    .addCase(pieceMoved, (state, action) => {
      gameAdapter.updateOne(state, {
        id: action.payload.id,
        changes: {
          currentPositionId: action.payload.positionId,
        },
      });
    });
});
