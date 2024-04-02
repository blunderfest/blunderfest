import { createAction } from "@reduxjs/toolkit";

export const joined = createAction(
  "room/joined",
  /**
   * @param {string} roomCode
   * @param {string[]} games
   * @param {Record<string, any>} gamesByCode
   * @param {string} activeGame
   */
  (roomCode, games, gamesByCode, activeGame) => ({
    meta: {
      remote: true,
    },
    payload: {
      roomCode,
      games,
      gamesByCode,
      activeGame,
    },
  })
);
