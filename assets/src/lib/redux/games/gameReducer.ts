import { createSlice } from "@reduxjs/toolkit";
import { createGameAction, joined } from "..";

export type Square = {
    color: "dark" | "light";
    square_index: number;
    selected: boolean;
    marked: boolean;
};

export type Game = {
    game_code: string;
    position: string;
    squares: Square[];
};

export type GameState = {
    games: string[];
    games_by_code: Record<string, Game>;
};

const initialState: GameState = {
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
                const gameCode = action.meta.gameCode;
                const { rank, file } = action.payload;

                const square = state.games_by_code[gameCode].squares.find((square) => square.square_index === rank * 8 + file);
                if (square) {
                    square.selected = true;
                }
            }
        ),
        mark: create.preparedReducer(
            (roomCode: string, gameCode: string, file: number, rank: number) =>
                createGameAction(roomCode, gameCode, { file, rank }),
            (state, action) => {
                const gameCode = action.meta.gameCode;
                const { rank, file } = action.payload;

                const square = state.games_by_code[gameCode].squares.find((square) => square.square_index === rank * 8 + file);
                if (square) {
                    square.marked = true;
                }
            }
        ),
    }),
    extraReducers(builder) {
        builder.addCase(joined, (_state, action) => {
            return {
                games: action.payload.games,
                games_by_code: action.payload.games_by_code,
            };
        });
    },
});

export const gameReducer = gameSlice.reducer;

export const { mark, select } = gameSlice.actions;
