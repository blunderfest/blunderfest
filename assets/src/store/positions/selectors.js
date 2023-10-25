export const dummySelector = {};

// import { parseFen } from "@/features/parsers/parseFen";
// import { createSelector } from "@reduxjs/toolkit";

// const selectActiveGame = (/** @type {import("@/store").RootState} */ state) => state.game.byId[state.room.activeGame];

// export const selectActivePosition = createSelector(selectActiveGame, (game) => {
//   if (!game) {
//     return undefined;
//   }

//   const position = parseFen(game.position.fen);
//   return { ...position, ...game.position };
// });
