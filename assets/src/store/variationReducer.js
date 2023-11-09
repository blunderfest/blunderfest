import { createEntityAdapter, createReducer, createSelector } from "@reduxjs/toolkit";
import { pieceMoved } from "./actions";

/**
 * @typedef {{move: Move, gameId: String, positionId: String, variations: Variation[]}} Variation
 * @type {import("@reduxjs/toolkit").EntityAdapter<Variation>}
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
    gameId: variationFromServer.gameId,
    move: variationFromServer.move,
    positionId: variationFromServer.position.positionId,
    variations: variationFromServer.variations.map((variation) => convert(variation)),
  };
}

export const variationReducer = createReducer(variationAdapter.getInitialState(), (builder) => {
  builder.addCase(pieceMoved, (state, action) => {
    variationAdapter.upsertOne(state, convert(action.payload));
  });
});

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
     * @param {import(".").RootState} state
     * @param {String} gameId
     */
    (state, gameId) => gameId,
  ],
  (variations, gameId) => {
    const variation = variations[gameId];

    if (variation) {
      return { ...variation, variations: [variation] };
    }
    return undefined;
  },
);
