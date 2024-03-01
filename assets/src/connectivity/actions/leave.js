import { createAction } from "@reduxjs/toolkit";

export const leave = createAction(
  "leave",
  /**
   * @param {string} roomCode
   */
  (roomCode) => ({
    payload: {
      roomCode,
    },
  })
);
