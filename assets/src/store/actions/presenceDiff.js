import { createAction } from "@reduxjs/toolkit";

export const presenceDiff = createAction(
  "presence_diff",
  /**
   * @param {Record<string, Presence>} leaves
   * @param {Record<string, Presence>} joins
   */
  (leaves, joins) => ({
    payload: {
      leaves,
      joins,
    },
  }),
);
