import { createAction } from "@reduxjs/toolkit";

export const connected = createAction(
  "server/connected",
  /**
   * @param {string} userId
   * @param {string} roomCode
   */
  (userId, roomCode) => ({ payload: { userId, roomCode } }),
);
