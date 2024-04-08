import { createAction } from "@reduxjs/toolkit";

export const connected = createAction(
  "connectivity/connected",
  /**
   * @param {string} userToken
   */
  (userToken) => ({
    payload: {
      userToken,
    },
  })
);
