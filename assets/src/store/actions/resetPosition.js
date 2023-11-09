import { createAction } from "@reduxjs/toolkit";

export const resetPosition = createAction(
  "resetPosition",
  /**
   * @param {string} positionId
   */
  (positionId) => ({
    payload: positionId,
  }),
);
