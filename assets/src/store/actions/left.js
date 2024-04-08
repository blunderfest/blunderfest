import { createAction } from "@reduxjs/toolkit";

export const left = createAction(
  "room/left",
  /**
   * @param {string} roomCode
   */
  (roomCode) => ({
    payload: { roomCode },
  })
);
