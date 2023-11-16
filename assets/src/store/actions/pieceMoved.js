import { createAction } from "@reduxjs/toolkit";

export const pieceMoved = createAction(
  "pieceMoved",
  /**
   * @param {string} gameCode
   * @param {VariationFromServer} variation
   */
  (gameCode, variation) => ({ payload: { gameCode, variation } }),
);
