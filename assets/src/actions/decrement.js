import { createAction } from "@reduxjs/toolkit";

export const decrement = createAction(
  "decrement",
  /**
   * @param {string} roomCode
   */
  (roomCode) => ({
    meta: {
      roomCode,
    },
  })
);
