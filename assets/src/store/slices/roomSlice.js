import { createSlice } from "@reduxjs/toolkit";
import { joined } from "../actions/joined";
import { left } from "../actions/left";
import { selectGame } from "../actions/selectGame";

/**
 * @typedef {Object} State
 * @property {string} roomCode
 * @property {string[]} games
 * @property {string} currentGame
 */

/**
 * @type {State}
 */
const initialState = {
  roomCode: "",
  games: [],
  currentGame: "",
};

const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(joined, (state, action) => {
      state.roomCode = action.payload.roomCode;
      state.games = action.payload.games;
      state.currentGame = action.payload.currentGame;
    });

    builder.addCase(left, (state) => {
      state.roomCode = "";
    });

    builder.addCase(selectGame, (state, action) => {
      state.currentGame = action.payload.gameCode;
    });
  },
  selectors: {
    selectCurrentGame: (state) => state.currentGame,
  },
});

export const roomReducer = roomSlice.reducer;
export const { selectCurrentGame } = roomSlice.selectors;
