import { createAction } from "@reduxjs/toolkit";

export const joined = createAction(
  "room/joined",
  /**
   * @param {string} roomCode
   * @param {string[]} games
   * @param {Record<string, any>} gamesByCode
   * @param {string} currentGame
   */
  (roomCode, games, gamesByCode, currentGame) => ({
    payload: {
      roomCode,
      games,
      gamesByCode,
      currentGame,
    },
  })
);
