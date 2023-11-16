import { createAction } from "@reduxjs/toolkit";

export const resetPosition = createAction(
  "position/reset",
  /**
   * @param {string} positionId
   */
  (positionId) => ({
    payload: { positionId },
  }),
);
