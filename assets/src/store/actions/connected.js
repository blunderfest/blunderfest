import { createAction } from "@reduxjs/toolkit";

export const connected = createAction(
  "connected",
  /**
   * @param {string} userId
   * @param {string} roomCode
   */
  (userId, roomCode) => ({ payload: { userId, roomCode } }),
);
