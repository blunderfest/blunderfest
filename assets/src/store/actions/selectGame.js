import { createAction } from "@reduxjs/toolkit";

export const selectGame = createAction(
  "room/selectGame",
  /**
   * @param {string} gameCode
   */
  (gameCode) => ({
    payload: {
      gameCode,
    },
  })
);
