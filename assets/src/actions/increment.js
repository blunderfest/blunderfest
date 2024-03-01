import { createAction } from "@reduxjs/toolkit";

export const increment = createAction(
  "room/increment",
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
