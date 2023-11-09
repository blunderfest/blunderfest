import { createAction } from "@reduxjs/toolkit";

export const pieceMoved = createAction(
  "pieceMoved",
  /**
   * @param {MovedFromServer} move
   */
  (move) => ({ payload: move }),
);
