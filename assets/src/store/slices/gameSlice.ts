import { createSlice } from "@reduxjs/toolkit";
import { joined } from "~/actions/joined";
import { Game } from "~/types/Piece";

type State = {
  gamesByCode: Record<string, Game>;
};

const initialState: State = {
  gamesByCode: {},
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(joined, (state, action) => {
      state.gamesByCode = action.payload.gamesByCode;
    });
  },
});

export const gameReducer = gameSlice.reducer;
