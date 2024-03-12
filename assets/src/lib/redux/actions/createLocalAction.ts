import { PayloadAction } from "@reduxjs/toolkit";

export const createLocalAction = <T>(payload: T) => ({
    meta: {
        local: true,
    },
    payload: payload,
});

export const createRoomAction = <T>(roomCode: string, payload: T) => ({
    meta: {
        roomCode: roomCode,
    },
    payload: payload,
});

export const createGameAction = <T>(roomCode: string, gameCode: string, payload: T) => ({
    meta: {
        roomCode: roomCode,
        gameCode: gameCode,
    },
    payload: payload,
});

type LocalAction = PayloadAction<object, string, { local: boolean }>;
type RemoteAction = PayloadAction<object, string, { remote: boolean }>;
type RoomAction = PayloadAction<object, string, { roomCode: string }>;

export function isRemoteAction(action: unknown): action is RemoteAction {
    const remoteAction = action as RemoteAction;

    return remoteAction.meta.remote;
}

export function isLocalAction(action: unknown): action is LocalAction {
    const payloadAction = action as LocalAction;

    return payloadAction.meta && payloadAction.meta.local;
}

export function isRoomAction(action: unknown): action is RoomAction {
    const roomAction = action as RoomAction;

    return !!roomAction.meta && !!roomAction.meta.roomCode && !isLocalAction(action) && !isRemoteAction(action);
}
