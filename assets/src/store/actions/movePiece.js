import { createAction } from "@reduxjs/toolkit";

export const movePiece = createAction(
  "piece/move",
  /**
   * @param {string} gameCode
   * @param {string} positionId
   * @param {Move} move
   */
  (gameCode, positionId, move) => ({ payload: { gameCode, positionId, move } }),
);
