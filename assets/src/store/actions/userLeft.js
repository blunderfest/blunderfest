import { createAction } from "@reduxjs/toolkit";

export const userLeft = createAction(
  "userLeft",
  /**
   * @param {string} userId
   */
  (userId) => ({ payload: userId }),
);
