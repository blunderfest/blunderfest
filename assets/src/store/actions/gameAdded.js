import { createAction } from "@reduxjs/toolkit";

export const gameAdded = createAction(
  "game/added",
  /**
   * @param {GameFromServer} game
   */
  (game) => ({ payload: game }),
);
