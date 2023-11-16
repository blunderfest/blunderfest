import { createAction } from "@reduxjs/toolkit";

export const presenceState = createAction(
  "presence_state",
  /**
   * @param {Record<string, Presence>} presences
   */
  (presences) => ({
    payload: presences,
  }),
);
