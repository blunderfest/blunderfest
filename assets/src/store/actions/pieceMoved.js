import { createAction } from "@reduxjs/toolkit";

export const pieceMoved = createAction(
  "piece/moved",
  /**
   * @param {string} gameCode
   * @param {VariationFromServer} variation
   */
  (gameCode, variation) => ({ payload: { gameCode, variation } }),
);
