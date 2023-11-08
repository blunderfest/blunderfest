import { createAction } from "@reduxjs/toolkit";

export const connected = createAction(
  "connectivity/connected",
  /**
   * @param {string} userId
   * @param {string} roomCode
   */
  (userId, roomCode) => ({
    payload: {
      userId,
      roomCode,
    },
  }),
);

export const disconnected = createAction("connectivity/disconnected");
