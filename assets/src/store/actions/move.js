import { createAction } from "@reduxjs/toolkit";

export const move = createAction(
  "game/move",
  /**
   * @param {string} gameCode
   * @param {Move} move
   */
  (gameCode, move) => ({
    payload: {
      gameCode,
      move,
    },
  })
);
