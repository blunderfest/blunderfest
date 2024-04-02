import { createAction } from "@reduxjs/toolkit";

export const left = createAction(
  "room/left",
  /**
   * @param {string} roomCode
   */
  (roomCode) => ({
    meta: {
      remote: true,
    },
    payload: { roomCode },
  })
);
