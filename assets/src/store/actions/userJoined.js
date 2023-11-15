import { createAction } from "@reduxjs/toolkit";

export const userJoined = createAction(
  "userJoined",
  /**
   * @param {string} userId
   */
  (userId) => ({ payload: userId }),
);
