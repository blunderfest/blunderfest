import { createSlice } from "@reduxjs/toolkit";
import { createLocalAction } from "../actions";
import { Game } from "../games";

type Connectivity = {
    status: "connecting" | "disconnecting" | "online" | "offline";
    rooms: string[];
    userId: string;
};

const initialState: Connectivity = {
    status: "offline",
    rooms: [],
    userId: "",
};

const connectivitySlice = createSlice({
    name: "connectivity",
    initialState: initialState,
    reducers: (create) => ({
        connect: create.preparedReducer(
            () => createLocalAction({}),
            (state) => {
                state.status = "connecting";
            }
        ),

        connected: create.preparedReducer(
            () => createLocalAction({}),
            (state) => {
                state.status = "online";
            }
        ),

        disconnect: create.preparedReducer(
            () => createLocalAction({}),
            (state) => {
                state.status = "disconnecting";
            }
        ),

        disconnected: create.preparedReducer(
            () => createLocalAction({}),
            (state) => {
                state.status = "offline";
            }
        ),

        join: create.preparedReducer(
            (userId: string, roomCode: string) =>
                createLocalAction({
                    userId,
                    roomCode,
                }),
            (state, action) => {
                state.userId = action.payload.userId;
            }
        ),

        joined: create.preparedReducer(
            (payload: { room_code: string; active_game: string; games: string[]; games_by_code: Record<string, Game> }) =>
                createLocalAction(payload),
            (state, action) => {
                state.rooms = [action.payload.room_code];
            }
        ),

        leave: create.preparedReducer(
            (roomCode: string) => createLocalAction({ roomCode }),
            () => {}
        ),

        left: create.preparedReducer(
            (roomCode: string) => createLocalAction({ roomCode }),
            (state, action) => {
                state.rooms = state.rooms.filter((room) => room !== action.payload.roomCode);
            }
        ),
    }),
    selectors: {
        selectOnline: (state) => state.status === "online",
        selectRooms: (state) => state.rooms,
        selectUserId: (state) => state.userId,
    },
});

export const connectivityReducer = connectivitySlice.reducer;
export const { connect, connected, disconnect, disconnected, join, joined, leave, left } = connectivitySlice.actions;
export const { selectOnline, selectRooms, selectUserId } = connectivitySlice.selectors;
