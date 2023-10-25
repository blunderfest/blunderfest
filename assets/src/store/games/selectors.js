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

    // /**
    //  * @param {Variation} variation
    //  * @returns {MappedMove}
    //  */
    // function mapToMoves(variation) {
    //   return {
    //     id: variation.position.id,
    //     move: variation.move,
    //     ply: variation.position.ply,
    //     moves: variation.variations.map((v) => mapToMoves(v)),
    //   };
    // }

    // /**
    //  * @param {MappedMove[]} moves
    //  * @returns {MappedMove}
    //  */
    // function mapGame(moves) {
    //   return {
    //     id: game.id,
    //     move: undefined,
    //     ply: 0,
    //     moves: moves,
    //   };
    // }

    // const moves = variations.map((v) => mapToMoves(v));
    return variations;
  },
);

// export const selectMoves = createSelector(selectMainVariation, (variations) => {
//   /**
//    * @typedef {{
//    *   move: Move,
//    *   ply: number,
//    *   moves: MappedMove[]
//    * }} MappedMove
//    *
//    * @param {Variation | undefined} variation
//    * @returns {MappedMove}
//    */
//   function mapMoves(variation) {
//     if (!variation) {
//       return {
//         move: {
//           from: -1,
//           to: -1,
//         },
//         moves: [],
//         ply: 0,
//       };
//     }

//     return {
//       move: variation.move,
//       ply: variation.position.ply,
//       moves: variation.variations.map((v) => mapMoves(v)),
//     };
//   }

//   if (variations.length === 0) {
//     return [];
//   }

//   /**
//    * @typedef {{
//    *   moveNumber: number,
//    *   white: MappedMove | undefined,
//    *   black: MappedMove | undefined,
//    *   moves:
//    * }} Return
//    * @param {MappedMove[]} moves
//    * @returns {Generator<Return>}
//    */
//   function* test(moves) {
//     for (let i = 0; i < moves.length; i++) {
//       const move = moves[i];
//       if (move.moves.length) {
//         if (move.ply % 2 === 1) {
//           yield {
//             moveNumber: (move.ply + 1) / 2,
//             white: move,
//             black: undefined,
//             moves: move.moves,
//           };
//         } else {
//           yield {
//             moveNumber: move.ply / 2,
//             white: undefined,
//             black: move,
//             moves: move.moves,
//           };
//         }
//       } else {
//         yield {
//           moveNumber: move.ply / 2,
//           white: move,
//           black: i + 1 < moves.length ? moves[i + 1] : undefined,
//           moves: [],
//         };

//         i++;
//       }
//     }
//   }

//   const moves = variations.map((v) => mapMoves(v));

//   return [...test(moves)];

//   //   if (first.position.ply % 2 == 0) {
//   //     const moves = [undefined, ...variations].map((variation) => mapMoves(variation));
//   //     return chunk(moves, 2);
//   //   } else {
//   //     const moves = variations.map((variation) => mapMoves(variation));
//   //     return chunk(moves, 2);
//   //   }

//   //   const moves = ;

//   //   if (variations.length) {
//   //     variations.map((v) => ({ move: v.move, ply: v.position.ply, moves: v.variations.map() }));

//   //     /**
//   //      * @type {Omit<Variation, "position">}
//   //      */
//   //     const dummy = {
//   //       move: {
//   //         from: -1,
//   //         to: -1,
//   //       },
//   //       variations: [],
//   //     };

//   //     const v2 = variations[0].position.ply % 2 === 1 ? variations : [dummy, ...variations];
//   //     const moves = v2.map((v) => mapMoves(v));

//   //     const c = chunk(moves, 2).map((move, index) => ({
//   //       w: move[0],
//   //       b: move[1],
//   //       moveCount: index + variations[0].position.ply,
//   //     }));
//   //     console.log("CHUNKS", c);

//   //     return c;
//   //   } else {
//   //     return [];
//   //   }

//   /**
//    * [variation1.move {moves: []}, variation2.move {moves: []}]
//    * [variation3.move {moves: [variation3.2.move  {moves: []}]}, variation4.move {moves: []}]
//    * [variation3.move {moves: []}, variation4.move {moves: []}]
//    */

//   //   chunk(variations, 2);
//   //   return variations.sort((v1, v2) => v1.position.ply - v2.position.ply).map((v) => v.move);
// });
