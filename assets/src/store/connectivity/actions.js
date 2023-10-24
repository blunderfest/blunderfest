import { createAction } from "@reduxjs/toolkit";

export const connect = createAction(
  "connectivity/connect",
  /**
   * @param {string} userId
   * @param {string} roomCode
   */
  (userId, roomCode) => ({
    meta: {
      skipSocket: true,
    },
    payload: {
      userId,
      roomCode,
    },
  }),
);

export const disconnect = createAction("connectivity/disconnect", () => ({
  meta: {
    skipSocket: true,
  },
  payload: {},
}));
