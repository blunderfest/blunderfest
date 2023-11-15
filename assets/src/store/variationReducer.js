import { createEntityAdapter, createReducer, createSelector } from "@reduxjs/toolkit";
import { pieceMoved } from "./actions";

/**
 * @typedef {{move: Move, ply: number, positionId: string, variations: Variation[]}} Variation
 * @typedef {{gameId: string, variations: Variation[]}} Game
 * @type {import("@reduxjs/toolkit").EntityAdapter<Game>}
 */
const variationAdapter = createEntityAdapter({
  selectId: (variation) => variation.gameId,
});

/**
 * @param {VariationFromServer} variationFromServer
 * @returns {Variation}
 */
function convert(variationFromServer) {
  return {
    move: variationFromServer.move,
    ply: variationFromServer.position.ply,
    positionId: variationFromServer.position.positionId,
    variations: variationFromServer.variations.map((variation) => convert(variation)),
  };
}

export const variationReducer = createReducer(variationAdapter.getInitialState(), (builder) => {
  builder.addCase(pieceMoved, (state, action) => {
    const variation = state.entities[action.payload.gameId];

    if (variation) {
      variationAdapter.upsertOne(state, { ...variation, variations: [...variation.variations, convert(action.payload)] });
    } else {
      variationAdapter.addOne(state, { gameId: action.payload.gameId, variations: [convert(action.payload)] });
    }
  });
});

/**
 * {index, move}
 *
 * 0 e4
 *   0 d5
 *     0 exd5
 *       0 Qxd5
 *         0 Nc3
 *           0 Qd8
 *           1 Qa5
 *     1 Nc3
 *       0 dxe4
 *       1 d4
 *
 * e4
 * d5
 * exd5
 *   Nc3
 *   dxe4
 *     d4
 * Qxd5
 * Nc3
 * Qd8
 *   Qa5
 */

/**
 * @returns {Variation}
 */
export const selectVariation = createSelector(
  [
    /**
     * @param {import(".").RootState} state
     */
    (state) => state.variation.entities,

    /**
     * @param {import(".").RootState} _state
     * @param {String} gameId
     */
    (_state, gameId) => gameId,
  ],
  (variations, gameId) => {
    const game = variations[gameId];

    if (game) {
      return game.variations;
    }

    return [];
  },
);
