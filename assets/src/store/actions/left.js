import { createAction } from "@reduxjs/toolkit";

export const left = createAction(
  "left",
  /**
   * @param {string} userId
   */
  (userId) => ({ payload: userId }),
);
