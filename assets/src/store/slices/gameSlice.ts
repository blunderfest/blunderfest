import { createSlice } from "@reduxjs/toolkit";
import { joined } from "./connectivitySlice";

type Square = {
  squareIndex: number;
  color: "dark" | "light";
  //   piece: "k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P" | null;
};

type Game = {
  position: string;
  gameCode: string;
  squares: Square[];
};

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
