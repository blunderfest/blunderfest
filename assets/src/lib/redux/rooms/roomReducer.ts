import { createSlice } from "@reduxjs/toolkit";
import { joined } from "..";

export type Square = {
    color: "dark" | "light";
    square_index: number;
};

export type Game = {
    game_code: string;
    position: string;
    squares: Square[];
};

export type Room = {
    room_code: string;
    games: string[];
    games_by_code: Record<string, Game>;
};

type State = {
    rooms: string[];
    rooms_by_code: Record<string, Room>;
};

const initialState: State = {
    rooms: [],
    rooms_by_code: {},
};

const roomSlice = createSlice({
    name: "room",
    initialState,
    reducers: {},
    extraReducers(builder) {
        builder.addCase(joined, (state, action) => {
            state.rooms.push(action.payload.room.room_code);
            state.rooms_by_code[action.payload.room.room_code] = action.payload.room;
        });
    },
});

export const roomReducer = roomSlice.reducer;
