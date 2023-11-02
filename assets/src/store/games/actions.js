import { createAction } from "@reduxjs/toolkit";

export const move = createAction(
  "game/move",
  /**
   * @param {string} gameId
   * @param {string} positionId
   * @param {Move} move
   */
  (gameId, positionId, move) => ({
    payload: {
      gameId,
      positionId,
      move,
    },
  }),
);

export const moved = createAction(
  "game/moved",
  /**
   * @param {string} gameId
   * @param {string} positionId
   * @param {number} ply
   * @param {string} fen
   * @param {Move} move
   */
  (gameId, positionId, ply, fen, move) => ({
    payload: {
      gameId,
      positionId,
      ply,
      fen,
      move,
    },
  }),
);
