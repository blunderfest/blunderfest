import { createAction } from "@reduxjs/toolkit";

export const selectPosition = createAction(
  "position/select",
  /**
   * @param {string} gameCode
   * @param {string} positionId
   */
  (gameCode, positionId) => ({ payload: { gameCode, positionId } }),
);
