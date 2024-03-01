import { createAction } from "@reduxjs/toolkit";

export const decrement = createAction(
  "room/decrement",
  /**
   * @param {string} roomCode
   */
  (roomCode) => ({
    meta: {
      roomCode,
    },
  })
);
