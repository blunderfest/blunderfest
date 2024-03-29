import { Game } from "@/types/Piece";
import { createAction } from "@reduxjs/toolkit";

export const joined = createAction(
  "room/joined",
  (roomCode: string, games: string[], gamesByCode: Record<string, Game>, activeGame: string) => ({
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

export const left = createAction("room/left", (roomCode: string) => ({
  meta: {
    remote: true,
  },
  payload: { roomCode },
}));

export const connect = createAction("connectivity/connect", () => ({
  meta: {
    remote: true,
  },
  payload: {},
}));

export const connected = createAction("connectivity/connected", (userToken: string) => ({
  meta: {
    remote: true,
  },
  payload: {
    userToken,
  },
}));

export const disconnect = createAction("connectivity/disconnect", () => ({
  meta: {
    remote: true,
  },
  payload: {},
}));

export const disconnected = createAction("connectivity/disconnected", () => ({
  meta: {
    remote: true,
  },
  payload: {},
}));

export const selectGame = createAction("room/selectGame", (gameCode: string) => ({
  payload: {
    gameCode,
  },
}));
