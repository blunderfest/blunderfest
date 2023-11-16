import { createAction } from "@reduxjs/toolkit";

export const deselectSquare = createAction(
  "square/deselect",
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
