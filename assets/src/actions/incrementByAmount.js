import { createAction } from "@reduxjs/toolkit";

export const incrementByAmount = createAction(
  "incrementByAmount",
  /**
   * @param {string} roomCode
   * @param {number} amount
   */
  (roomCode, amount) => ({
    meta: {
      roomCode,
    },
    payload: {
      amount,
    },
  })
);
