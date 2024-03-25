import { createSlice } from "@reduxjs/toolkit";

type State = {
  squares: {
    squareIndex: number;
    piece: "k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P" | null;
  }[];
};

const initialState: State = {
  squares: [],
};

const boardSlice = createSlice({
  name: "board",
  initialState,
  reducers: {},
});

export const boardReducer = boardSlice.reducer;
