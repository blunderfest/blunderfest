import { createAction } from "@reduxjs/toolkit";

export const join = createAction(
  "join",
  /**
   * @param {string} userId
   * @param {string} roomCode
   */
  (userId, roomCode) => ({
    payload: {
      userId,
      roomCode,
    },
  })
);
