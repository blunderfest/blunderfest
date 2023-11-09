import { createAction } from "@reduxjs/toolkit";

export const joined = createAction(
  "joined",
  /**
   * @param {string} userId
   */
  (userId) => ({ payload: userId }),
);
