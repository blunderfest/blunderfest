import { createAction } from "@reduxjs/toolkit";

export const movePiece = createAction(
  "movePiece",
  /**
   * @param {string} gameId
   * @param {string} positionId
   * @param {Move} move
   */
  (gameId, positionId, move) => ({ payload: { gameId, positionId, move } }),
);
