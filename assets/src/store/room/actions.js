import { createAction } from "@reduxjs/toolkit";

export const addGame = createAction(
  "games/add",
  /**
   * @param {Game} game
   */
  (game) => ({
    payload: { ...game },
  }),
);

export const switchGame = createAction(
  "room/switchGame",
  /**
   * @param {string} id
   */
  (id) => ({
    payload: {
      id,
    },
  }),
);

export const join = createAction(
  "room/join",
  /**
   * @param {string} userId
   */
  (userId) => ({
    meta: {
      skipSocket: true,
    },
    payload: {
      userId,
    },
  }),
);

export const leave = createAction(
  "room/leave",
  /**
   * @param {string} userId
   */
  (userId) => ({
    meta: {
      skipSocket: true,
    },
    payload: {
      userId,
    },
  }),
);
