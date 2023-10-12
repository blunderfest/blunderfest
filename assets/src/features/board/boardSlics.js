import { createSlice } from "@reduxjs/toolkit";

const files = [...Array.from({ length: 8 }).keys()];
const ranks = [...Array.from({ length: 8 }).keys()].reverse();

const initialState = /** @type Board */({
    squares: files.flatMap((file) =>
        ranks.map((rank) => ({
            square_index: file + rank * 8,
            color: file % 2 === rank % 2 ? "light" : "dark",
        })),
    ),
    selectedSquare: undefined,
    markedSquares: [],
});

/*

                            setBoard(
                                board.markedSquares.includes(square.square_index)
                                    ? {
                                            ...board,
                                            selectedSquare:
                                                board.selectedSquare === square.square_index
                                                    ? undefined
                                                    : board.selectedSquare,
                                            markedSquares: board.markedSquares.filter(
                                                (s) => s !== square.square_index,
                                            ),
                                      }
                                    : {
                                            ...board,
                                            selectedSquare:
                                                board.selectedSquare === square.square_index
                                                    ? undefined
                                                    : board.selectedSquare,

                                            markedSquares: [
                                                ...board.markedSquares,

                                                square.square_index,
                                            ],
                                      },
                            );

*/

export const boardSlice = createSlice({
    name: "board",
    initialState,
    reducers: {
        select: (state, /** @type {PayloadAction<number>} */ action) => {
            if (state.selectedSquare === action.payload || state.markedSquares.length) {
                state.selectedSquare = undefined;
            } else {
                state.selectedSquare = action.payload;
            }
            state.markedSquares = []
        },
        mark: (state, /** @type {PayloadAction<number>} */ action) => {
            const index = state.markedSquares.indexOf(action.payload)
            if (index !== -1) {
                state.markedSquares.splice(index, 1)
            } else {
                state.markedSquares.push(action.payload)
            }
        }
    }
});

export const { select, mark } = boardSlice.actions;

export const boardReducer = boardSlice.reducer;

