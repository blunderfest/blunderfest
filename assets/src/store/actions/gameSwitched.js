import { createAction } from "@reduxjs/toolkit";

export const gameSwitched = createAction(
  "game/switch",
  /**
   * @param {string} gameCode
   */
  (gameCode) => ({ payload: { gameCode } }),
);
