import { createAction } from "@reduxjs/toolkit";

export const selectPosition = createAction(
  "selectPosition",
  /**
   * @param {string} gameCode
   * @param {string} positionId
   */
  (gameCode, positionId) => ({ payload: { gameCode, positionId } }),
);
