import { createAction } from "@reduxjs/toolkit";

export const selectSquare = createAction(
  "square/select",
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
