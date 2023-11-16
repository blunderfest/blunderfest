import { createAction } from "@reduxjs/toolkit";

export const movePiece = createAction(
  "movePiece",
  /**
   * @param {string} gameCode
   * @param {string} positionId
   * @param {Move} move
   */
  (gameCode, positionId, move) => ({ payload: { gameCode, positionId, move } }),
);
