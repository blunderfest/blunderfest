import { createAction } from "@reduxjs/toolkit";

export const select = createAction(
  "board/select",
  /**
   * @param {number} squareIndex
   */
  (squareIndex) => ({
    payload: {
      squareIndex,
    },
  }),
);

export const reset = createAction("board/reset");

export const mark = createAction(
  "board/mark",
  /**
   * @param {number} squareIndex
   * @param {Mark} mark
   */
  (squareIndex, mark) => ({
    payload: {
      squareIndex,
      mark,
    },
  }),
);
