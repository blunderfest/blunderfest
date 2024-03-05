import { createSlice } from "@reduxjs/toolkit";
import { connect, disconnect, join, leave } from "./actions/actions";

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
    extraReducers: (builder) => {
        builder
            .addCase(connect.fulfilled, (state) => {
                state.online = true;
            })
            .addCase(connect.rejected, (state) => {
                state.online = false;
            })
            .addCase(disconnect.fulfilled, (state) => {
                state.online = false;
            })
            .addCase(join.fulfilled, (state, action) => {
                if (!state.rooms.includes(action.meta.arg.roomCode)) {
                    state.rooms.push(action.meta.arg.roomCode);
                }

                state.userId = action.meta.arg.userId;
            })
            .addCase(leave.fulfilled, (state, action) => {
                state.rooms = state.rooms.filter((room) => room !== action.meta.arg.roomCode);
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
