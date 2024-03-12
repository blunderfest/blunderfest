import { createSlice } from "@reduxjs/toolkit";
import { createLocalAction, joined } from "..";

export type Room = {
    room_code: string;
    games: string[];
    activeGame: string;
};

export type RoomState = {
    rooms: string[];
    rooms_by_code: Record<string, Room>;
};

const initialState: RoomState = {
    rooms: [],
    rooms_by_code: {},
};

const roomSlice = createSlice({
    name: "rooms",
    initialState,
    reducers: (create) => ({
        select: create.preparedReducer(
            (roomCode: string, gameCode: string) => createLocalAction({ roomCode, gameCode }),
            (state, action) => {
                state.rooms_by_code[action.payload.roomCode].activeGame = action.payload.gameCode;
            }
        ),
    }),
    extraReducers(builder) {
        builder.addCase(joined, (_state, action) => {
            return {
                rooms: [action.payload.room_code],
                rooms_by_code: {
                    [action.payload.room_code]: {
                        room_code: action.payload.room_code,
                        games: action.payload.games,
                        activeGame: action.payload.games.at(0) ?? "",
                    },
                },
            };
        });
    },
});

export const { select } = roomSlice.actions;
export const roomReducer = roomSlice.reducer;
