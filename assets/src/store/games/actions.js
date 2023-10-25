import { createAction } from "@reduxjs/toolkit";

export const move = createAction(
  "game/move",
  /**
   *
   * @param {string} gameId
   * @param {Variation} variation
   * @returns
   */
  (gameId, variation) => ({
    payload: {
      gameId,
      variation,
    },
  }),
);
