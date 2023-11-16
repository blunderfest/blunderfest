import { createAction } from "@reduxjs/toolkit";

export const gameSwitched = createAction(
  "gameSwitched",
  /**
   * @param {string} gameCode
   */
  (gameCode) => ({ payload: gameCode }),
);
