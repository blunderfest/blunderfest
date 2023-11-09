import { createAction } from "@reduxjs/toolkit";

export const gameAdded = createAction(
  "gameAdded",
  /**
   * @param {GameFromServer} game
   */
  (game) => ({ payload: game }),
);
