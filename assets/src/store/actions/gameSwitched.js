import { createAction } from "@reduxjs/toolkit";

export const gameSwitched = createAction(
  "gameSwitched",
  /**
   * @param {string} gameId
   */
  (gameId) => ({ payload: gameId }),
);
