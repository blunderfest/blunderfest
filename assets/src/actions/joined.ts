import { createAction } from "@reduxjs/toolkit";
import { Game } from "~/types/Piece";

export const joined = createAction(
  "room/joined",
  (roomCode: string, games: string[], gamesByCode: Record<string, Game>, activeGame: string) => ({
    payload: {
      roomCode,
      games,
      gamesByCode,
      activeGame,
    },
  })
);

export const left = createAction("room/left", (roomCode: string) => ({
  payload: { roomCode },
}));

export const connect = createAction("connectivity/connect");

export const connected = createAction("connectivity/connected", (userToken: string) => ({
  payload: {
    userToken,
  },
}));

export const disconnect = createAction("connectivity/disconnect");

export const disconnected = createAction("connectivity/disconnected");

export const selectGame = createAction("room/selectGame", (gameCode: string) => ({
  payload: {
    gameCode,
  },
}));