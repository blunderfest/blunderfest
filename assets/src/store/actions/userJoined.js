import { createAction } from "@reduxjs/toolkit";

export const userJoined = createAction(
  "user/joined",
  /**
   * @param {string} userId
   */
  (userId) => ({ payload: userId }),
);
