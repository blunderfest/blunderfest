import { createSlice } from "@reduxjs/toolkit";
import { joined } from "../actions/joined";
import { left } from "../actions/left";
import { selectGame } from "../actions/selectGame";

/**
 * @typedef {Object} State
 * @property {string} roomCode
 * @property {string[]} games
 * @property {string} activeGame
 */

/**
 * @type {State}
 */
const initialState = {
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
