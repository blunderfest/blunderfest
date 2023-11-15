import { createAction } from "@reduxjs/toolkit";

export const selectPosition = createAction(
  "selectPosition",
  /**
   * @param {string} gameId
   * @param {string} positionId
   */
  (gameId, positionId) => ({ payload: { gameId, positionId } }),
);
