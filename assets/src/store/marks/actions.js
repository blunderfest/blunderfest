import { createAction } from "@reduxjs/toolkit";

export const mark = createAction(
  "mark/mark",
  /**
   * @param {string} positionId,
   * @param {number} squareIndex
   * @param {Mark} mark
   */
  (positionId, squareIndex, mark) => ({
    payload: {
      positionId,
      squareIndex,
      mark,
    },
  }),
);
