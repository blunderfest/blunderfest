import { joined, left, selectGame } from "@/actions/joined";
import { createSlice } from "@reduxjs/toolkit";

type State = {
  roomCode: string;
  games: string[];
  activeGame: string;
};

const initialState: State = {
  roomCode: "",
  games: [],
  activeGame: "",
};

const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(joined, (state, action) => {
      state.roomCode = action.payload.roomCode;
      state.games = action.payload.games;
      state.activeGame = action.payload.activeGame;
    });

    builder.addCase(left, (state) => {
      state.roomCode = "";
    });

    builder.addCase(selectGame, (state, action) => {
      state.activeGame = action.payload.gameCode;
    });
  },
});

export const roomReducer = roomSlice.reducer;
