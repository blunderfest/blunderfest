import { RootState } from "@/store";
import { move } from "@/store/actions";
import type { Game } from "@/types";
import { createSelector, createSlice } from "@reduxjs/toolkit";
import { shallowEqual } from "react-redux";

type State = {
  games: Record<string, Game>;
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
  games: {
    some_game: {
      gameCode: "some_game",
      squares: [...Array(64).keys()].map((squareIndex) => ({
        squareIndex: squareIndex,
        color: ((9 * squareIndex) & 8) === 0 ? "dark" : "light",
        piece: defaultSquares[squareIndex],
      })),
    },
  },
};

export const boardSlice = createSlice({
  name: "board",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(move, (state, action) => {
      const game = state.games[action.payload.gameCode];
      const from = game.squares[action.payload.from];
      const to = game.squares[action.payload.to];

      to.piece = from.piece;
      from.piece = null;
    });
  },
});

const selectGame = createSelector(
  [(state: RootState) => state.board.games, (_state: RootState, gameCode: string) => gameCode],
  (games, gameCode) => games[gameCode]
);

export const selectSquares = createSelector(selectGame, (game) => game.squares, {
  memoizeOptions: {
    resultEqualityCheck: shallowEqual,
  },
});

export const selectSquare = createSelector(
  [selectGame, selectSquares, (_state: RootState, _gameCode: string, squareIndex: number) => squareIndex],
  (game, _squares, squareIndex) => game.squares[squareIndex]
);
