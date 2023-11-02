import { createSelector } from "reselect";

/**
 * @param {Variation[]} variations
 * @returns {Generator<Variation>}
 */
function* flattenVariations(variations) {
  if (variations.length === 0) {
    return;
  }

  const variation = variations[0];

  yield { ...variation, variations: [...variations].splice(1) };
  yield* flattenVariations(variation.variations);
}

export const selectMainVariation = createSelector(
  /**
   * @param {import("@/store").RootState} state
   * @param {string} gameId
   */
  (state, gameId) => state.game.byId[gameId],
  (game) => {
    const variations = [...flattenVariations(game.variations)];

    return variations;
  },
);
