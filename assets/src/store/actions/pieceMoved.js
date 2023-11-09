import { createAction } from "@reduxjs/toolkit";

export const pieceMoved = createAction(
  "pieceMoved",
  /**
   * @param {VariationFromServer} variation
   */
  (variation) => ({ payload: variation }),
);
