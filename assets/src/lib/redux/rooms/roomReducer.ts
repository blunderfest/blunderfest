import { createSlice } from "@reduxjs/toolkit";
import { joined } from "..";

export type Room = {
    room_code: string;
    games: string[];
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
    name: "rooms",
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
