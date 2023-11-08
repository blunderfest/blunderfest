import { createSlice } from "@reduxjs/toolkit";

/**
 * @type {{
 *   users: string[],
 *   games: string[],
 *   activeGame?: string
 * }}
 */
const initialState = {
  users: [],
  games: [],
  activeGame: "",
};

export const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {
    joined: (state, /** @type {PayloadAction<string>} */ action) => {
      state.users.push(action.payload);
    },
    left: (state, /** @type {PayloadAction<string>} */ action) => {
      state.users = state.users.filter((user) => user != action.payload);
    },
    gameAdded: (state, /** @type {PayloadAction<Game>} */ action) => {
      const { id } = action.payload;

      state.users.push(id);
      if (!state.activeGame) {
        state.activeGame = id;
      }
    },
    gameSwitched: (state, /** @type {PayloadAction<string>} */ action) => {
      state.activeGame = action.payload;
    },
  },
});

export const { joined, left, gameAdded, gameSwitched } = roomSlice.actions;
export const roomReducer = roomSlice.reducer;
