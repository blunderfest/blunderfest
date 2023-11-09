import { parseFen } from "@/features/parsers/parseFen";
import { createEntityAdapter, createReducer } from "@reduxjs/toolkit";
import { deselectSquare, gameAdded, pieceMoved, resetPosition, selectSquare } from "./actions";

/**
 * @typedef {{positionId: string, selectedSquareIndex: number?, arrows: Arrow[]} & ParsedPosition} Position
 * @type {import("@reduxjs/toolkit").EntityAdapter<Position>}
 */
const positionAdapter = createEntityAdapter({
  selectId: (position) => position.positionId,
});

/**
 * @param {PositionFromServer} positionFromServer
 * @returns {Position}
 */
function convert(positionFromServer) {
  return {
    positionId: positionFromServer.positionId,
    selectedSquareIndex: positionFromServer.selectedSquareIndex,
    arrows: positionFromServer.arrows,
    ...parseFen(positionFromServer.fen),
  };
}

export const positionReducer = createReducer(positionAdapter.getInitialState(), (builder) => {
  builder
    .addCase(selectSquare, (state, action) => {
      const { positionId, squareIndex } = action.payload;

      positionAdapter.updateOne(state, {
        id: positionId,
        changes: {
          selectedSquareIndex: squareIndex,
        },
      });
    })
    .addCase(deselectSquare, (state, action) => {
      const { positionId } = action.payload;

      positionAdapter.updateOne(state, {
        id: positionId,
        changes: {
          selectedSquareIndex: null,
        },
      });
    })
    .addCase(resetPosition, (state, action) => {
      const positionId = action.payload;
      const position = state.entities[positionId];

      if (position) {
        positionAdapter.updateOne(state, {
          id: positionId,
          changes: {
            selectedSquareIndex: null,
          },
        });
      }
    })
    .addCase(gameAdded, (state, action) => {
      positionAdapter.addOne(state, convert(action.payload.position));
    })
    .addCase(pieceMoved, (state, action) => {
      positionAdapter.addOne(state, convert(action.payload.position));
    });
});

export const { selectById } = positionAdapter.getSelectors((/** @type {import(".").RootState} */ state) => state.position);

// /**
//  * @param {VariationFromServer[]} variations
//  * @returns {Generator<VariationFromServer>}
//  */
// function* flattenVariations(variations) {
//   if (variations.length === 0) {
//     return;
//   }

//   const variation = variations[0];

//   yield { ...variation, variations: [...variations].splice(1) };
//   yield* flattenVariations(variation.variations);
// }

// export const selectMainVariation = createSelector(
//   [
//     /**
//      * @param {import(".").RootState} state
//      */
//     (state) => state.position.entities,

//     /**
//      * @param {import(".").RootState} state
//      */
//     (state) => state.game.entities,

//     /**
//      * @param {import(".").RootState} state
//      * @param {String} gameId
//      */
//     (state, gameId) => gameId,
//   ],
//   (positions, games, gameId) => {
//     const game = games[gameId];

//     if (game) {
//       const position = positions[game.currentPositionId];

//       if (position) {
//         const variations = [...flattenVariations(position.variations)];
//         return variations;
//       }
//     }

//     return [];
//   },
// );
