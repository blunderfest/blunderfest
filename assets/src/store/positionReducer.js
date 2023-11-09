import { createEntityAdapter, createReducer } from "@reduxjs/toolkit";
import { createSelector } from "reselect";
import { gameAdded, pieceMoved, resetPosition, selectSquare } from "./actions";

/**
 * @typedef {{move: Move, positionId: String, variations: Variation[]}} Variation
 * @type {import("@reduxjs/toolkit").EntityAdapter<Variation>}
 */
const variationAdapter = createEntityAdapter();

/**
 * @type {import("@reduxjs/toolkit").EntityAdapter<GameNode>}
 */
const positionAdapter = createEntityAdapter({
  selectId: (gameNode) => gameNode.position.id,
});

export const positionReducer = createReducer(positionAdapter.getInitialState(), (builder) => {
  builder
    .addCase(selectSquare, (state, action) => {
      const { positionId, squareIndex } = action.payload;
      const position = state.entities[positionId];

      if (position) {
        positionAdapter.updateOne(state, {
          id: action.payload.positionId,
          changes: {
            position: {
              ...position.position,
              selectedSquareIndex: position.position.selectedSquareIndex === squareIndex ? null : squareIndex,
            },
            variations: [],
          },
        });
      }
    })
    .addCase(resetPosition, (state, action) => {
      const positionId = action.payload;
      const position = state.entities[positionId];

      if (position) {
        positionAdapter.updateOne(state, {
          id: positionId,
          changes: {
            position: {
              ...position.position,
              selectedSquareIndex: null,
            },
            variations: [],
          },
        });
      }
    })
    .addCase(gameAdded, (state, action) => {
      positionAdapter.addOne(state, action.payload);
    })
    .addCase(pieceMoved, (state, action) => {
      const position = state.entities[action.payload.positionId];
      if (position) {
        // positionAdapter.updateOne(state, {
        //   id: position.position.id,
        //   changes: {
        //     variations: [
        //       ...position.variations,
        //       {
        //         variations: [],
        //         position: {
        //           id: action.payload.positionId,
        //           arrows: [],
        //           fen: action.payload.fen,
        //           ply: action.payload.ply,
        //           selectedSquareIndex: null,
        //         },
        //       },
        //     ],
        //   },
        // });
      }
      positionAdapter.addOne(
        state,
        variationAdapter.getInitialState({
          variations: [],
          position: {
            id: action.payload.positionId,
            arrows: [],
            fen: action.payload.fen,
            ply: action.payload.ply,
            selectedSquareIndex: null,
          },
        }),
      );
    });
});

export const { selectById } = positionAdapter.getSelectors((/** @type {import(".").RootState} */ state) => state.position);

/**
 * @param {VariationFromServer[]} variations
 * @returns {Generator<VariationFromServer>}
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
  [
    /**
     * @param {import(".").RootState} state
     */
    (state) => state.position.entities,

    /**
     * @param {import(".").RootState} state
     */
    (state) => state.game.entities,

    /**
     * @param {import(".").RootState} state
     * @param {String} gameId
     */
    (state, gameId) => gameId,
  ],
  (positions, games, gameId) => {
    const game = games[gameId];

    if (game) {
      const position = positions[game.currentPositionId];

      if (position) {
        const variations = [...flattenVariations(position.variations)];
        return variations;
      }
    }

    return [];
  },
);
