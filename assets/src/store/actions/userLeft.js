import { createAction } from "@reduxjs/toolkit";

export const userLeft = createAction(
  "user/left",
  /**
   * @param {string} userId
   */
  (userId) => ({ payload: { userId } }),
);
