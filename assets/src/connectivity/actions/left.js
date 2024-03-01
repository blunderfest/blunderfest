import { createAction } from "@reduxjs/toolkit";

export const left = createAction(
  "left",
  /**
   * @param {string} roomCode
   */
  (roomCode) => ({
    payload: {
      roomCode,
    },
  })
);
