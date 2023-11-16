import { createEntityAdapter, createReducer, createSelector } from "@reduxjs/toolkit";
import { pieceMoved } from "./actions";

/**
 * @typedef {{move: Move, ply: number, positionId: string, variations: Variation[]}} Variation
 * @typedef {{gameCode: string, variations: Variation[]}} Game
 *
 * @type {import("@reduxjs/toolkit").EntityAdapter<Game>}
 */
const variationAdapter = createEntityAdapter({
  selectId: (variation) => variation.gameCode,
});

/**
 * @param {VariationFromServer} variation
 * @returns {Variation}
 */
function convert(variation) {
  return {
    move: variation.move,
    ply: variation.position.ply,
    positionId: variation.position.positionId,
    variations: variation.variations.map((variation) => convert(variation)),
  };
}

export const variationReducer = createReducer(variationAdapter.getInitialState(), (builder) => {
  builder.addCase(pieceMoved, (state, action) => {
    const variation = state.entities[action.payload.gameCode];

    if (variation) {
      variationAdapter.upsertOne(state, {
        ...variation,
        variations: [...variation.variations, convert(action.payload.variation)],
      });
    } else {
      variationAdapter.addOne(state, { gameCode: action.payload.gameCode, variations: [convert(action.payload.variation)] });
    }
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
     * @param {import(".").RootState} _state
     * @param {String} gameCode
     */
    (_state, gameCode) => gameCode,
  ],
  (variations, gameCode) => {
    const game = variations[gameCode];

    if (game) {
      return game.variations;
    }

    return [];
  },
);
