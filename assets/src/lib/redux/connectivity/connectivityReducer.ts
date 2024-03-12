import { createSlice } from "@reduxjs/toolkit";
import { connected, disconnected, join, joined, left } from "./actions/actions";

type Connectivity = {
    online: boolean;
    rooms: string[];
    userId: string;
};

const initialState: Connectivity = {
    online: false,
    rooms: [],
    userId: "",
};

const connectivitySlice = createSlice({
    name: "connectivity",
    initialState: initialState,
    reducers: {},
    extraReducers(builder) {
        builder
            .addCase(connected, (state) => {
                state.online = true;
            })
            .addCase(disconnected, (state) => {
                state.online = false;
            })
            .addCase(join, (state, action) => {
                state.userId = action.payload.userId;
            })
            .addCase(joined, (state, action) => {
                if (!state.rooms.includes(action.payload.room.room_code)) {
                    state.rooms.push(action.payload.room.room_code);
                }
            })
            .addCase(left, (state, action) => {
                state.rooms = state.rooms.filter((room) => room !== action.payload.roomCode);
            });
    },
    selectors: {
        selectOnline: (state) => state.online,
        selectRooms: (state) => state.rooms,
        selectUserId: (state) => state.userId,
    },
});

export const connectivityReducer = connectivitySlice.reducer;

export const { selectOnline, selectRooms, selectUserId } = connectivitySlice.selectors;
