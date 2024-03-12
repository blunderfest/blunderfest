import { createSlice } from "@reduxjs/toolkit";
import { joined } from "..";

export type Room = {
    room_code: string;
    games: string[];
};

export type RoomState = {
    rooms: string[];
    rooms_by_code: Record<string, Room>;
    activeGame: string;
};

const initialState: RoomState = {
    rooms: [],
    rooms_by_code: {},
    activeGame: "",
};

const roomSlice = createSlice({
    name: "rooms",
    initialState,
    reducers: {},
    extraReducers(builder) {
        builder.addCase(joined, (_state, action) => {
            return {
                rooms: [action.payload.room_code],
                rooms_by_code: {
                    [action.payload.room_code]: {
                        room_code: action.payload.room_code,
                        games: action.payload.games,
                    },
                },
                activeGame: action.payload.active_game,
            };
        });
    },
});

export const roomReducer = roomSlice.reducer;
