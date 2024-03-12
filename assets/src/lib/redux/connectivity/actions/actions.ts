import { Room } from "@blunderfest/redux/rooms";
import { createAction } from "@reduxjs/toolkit";

export const connect = createAction("connectivity/connect", () => ({
    meta: {
        remote: true,
    },
    payload: {},
}));

export const connected = createAction("connectivity/connected", () => ({
    meta: {
        remote: true,
    },
    payload: {},
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

export const join = createAction("connectivity/join", (userId: string, roomCode: string) => ({
    meta: {
        remote: true,
    },
    payload: {
        userId,
        roomCode,
    },
}));

export const joined = createAction("connectivity/joined", (room: Room) => ({
    meta: {
        remote: true,
    },
    payload: {
        room,
    },
}));

export const leave = createAction("connectivity/leave", (roomCode: string) => ({
    meta: {
        remote: true,
    },
    payload: {
        roomCode,
    },
}));

export const left = createAction("connectivity/left", (roomCode: string) => ({
    meta: {
        remote: true,
    },
    payload: {
        roomCode,
    },
}));
