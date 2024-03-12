import { createSlice } from "@reduxjs/toolkit";
import { createGameAction } from "..";

export type Square = {
    color: "dark" | "light";
    square_index: number;
};

export type Game = {
    game_code: string;
    position: string;
    squares: Square[];
};

type State = {
    games: string[];
    games_by_code: Record<string, Game>;
};

const initialState: State = {
    games: [],
    games_by_code: {},
};

const gameSlice = createSlice({
    name: "games",
    initialState,
    reducers: (create) => ({
        select: create.preparedReducer(
            (roomCode: string, gameCode: string, file: number, rank: number) =>
                createGameAction(roomCode, gameCode, { file, rank }),
            (state, action) => {
                console.log(state.games, action.meta);
            }
        ),
        mark: create.preparedReducer(
            (roomCode: string, gameCode: string, file: number, rank: number) =>
                createGameAction(roomCode, gameCode, { file, rank }),
            (state, action) => {
                console.log(state.games, action.meta);
            }
        ),
    }),
});

export const gameReducer = gameSlice.reducer;

export const { mark, select } = gameSlice.actions;
