import { createAction } from "@reduxjs/toolkit";

export const select = createAction(
  "position/select",
  /**
   * @param {string} positionId,
   * @param {number} squareIndex
   */
  (positionId, squareIndex) => ({
    payload: {
      positionId,
      squareIndex,
    },
  }),
);

export const reset = createAction(
  "position/reset",
  /**
   * @param {string} positionId
   */
  (positionId) => ({
    payload: {
      positionId,
    },
  }),
);

export const mark = createAction(
  "position/mark",
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
