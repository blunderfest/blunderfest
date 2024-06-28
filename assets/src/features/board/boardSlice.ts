import { RootState } from "@/store";
import { flipBoard } from "@/store/actions";
import type { Square } from "@/types";
import { createSelector, createSlice } from "@reduxjs/toolkit";
import { shallowEqual } from "react-redux";

type State = {
  squares: Square[];
  flipped: boolean;
};

const defaultSquares = (
  [
    ["R", "N", "B", "Q", "K", "B", "N", "R"],
    ["P", "P", "P", "P", "P", "P", "P", "P"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["p", "p", "p", "p", "p", "p", "p", "p"],
    ["r", "n", "b", "q", "k", "b", "n", "r"],
  ] as const
).flat();

const initialState: State = {
  flipped: false,
  squares: [...Array(64).keys()].map((squareIndex) => ({
    squareIndex: squareIndex,
    color: ((9 * squareIndex) & 8) === 0 ? "dark" : "light",
    piece: defaultSquares[squareIndex],
  })),
};

export const boardSlice = createSlice({
  name: "board",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(flipBoard, (state) => {
      state.flipped = !state.flipped;
    });
  },
});

export const selectSquares = createSelector(
  (state: RootState) => state.board.squares,
  (state: RootState) => state.board.flipped,
  (squares, flipped) => {
    const ranks = flipped ? [...Array(8).keys()] : [...Array(8).keys()].reverse();
    const files = flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];

    return ranks.flatMap((rank) => files.map((file) => squares[rank * 8 + file]));
  },
  {
    memoizeOptions: {
      resultEqualityCheck: shallowEqual,
    },
  }
);
