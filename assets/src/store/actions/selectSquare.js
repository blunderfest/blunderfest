import { createAction } from "@reduxjs/toolkit";

export const selectSquare = createAction(
  "selectSquare",
  /**
   * @param {string} positionId
   * @param {number} squareIndex
   */
  (positionId, squareIndex) => ({
    payload: {
      positionId,
      squareIndex,
    },
  }),
);
