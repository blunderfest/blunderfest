import { createAction } from "@reduxjs/toolkit";

export const joined = createAction(
  "joined",
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
