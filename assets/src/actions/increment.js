import { createAction } from "@reduxjs/toolkit";

export const increment = createAction(
  "increment",
  /**
   * @param {string} roomCode
   */
  (roomCode) => ({
    meta: {
      roomCode,
    },
    payload: {},
  })
);
