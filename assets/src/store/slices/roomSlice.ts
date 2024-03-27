import { createSlice } from "@reduxjs/toolkit";
import { joined } from "./connectivitySlice";

type State = {
    games: string[],
    active_game?: string;
};

const initialState: State = {
    games: [],
};

const roomSlice = createSlice({
    name: "room",
    initialState,
    reducers: {},
    extraReducers(builder) {
        builder.addCase(joined, (state, action) => {
            state.games = action.payload.games;
            state.active_game = action.payload.activeGame;
        })
    },
});

export const roomReducer = roomSlice.reducer;
