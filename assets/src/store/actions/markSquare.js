import { createAction } from "@reduxjs/toolkit";

export const markSquare = createAction(
  "square/mark",
  /**
   * @param {string} positionId
   * @param {number} squareIndex
   * @param {Mark} mark
   */
  (positionId, squareIndex, mark) => ({
    payload: { positionId, squareIndex, mark },
  }),
);
