import { createSlice } from "@reduxjs/toolkit";

const files = [...Array.from({ length: 8 }).keys()];
const ranks = [...Array.from({ length: 8 }).keys()].reverse();

/**
 * @typedef {{
 *   square_index: number,
 *   color: "light" | "dark"
 *   mark: "none" | "simple" | "alt" | "ctrl"
 * }} Square
 * 
 * @typedef {{
 *   squares: Square[],
 *   selectedSquare: number | undefined,
 * }} Board
 */

const initialState = /** @type Board */({
    squares: files.flatMap((file) =>
        ranks.map((rank) => ({
            square_index: file + rank * 8,
            color: file % 2 === rank % 2 ? "light" : "dark",
            mark: "none"
        })),
    ),
    selectedSquare: undefined,
});

/**
 * @param {Board} board
 * @param {number} square_index
 * 
 * @returns {Square}
 */
function getBySquareIndex(board, square_index) {
    const index = board.squares.findIndex(square => square.square_index === square_index);

    return board.squares[index];
}

/**
 * 
 * @param {Board} board
 */
function deselectAll(board) {
    Object.entries(board.squares).forEach(([, square]) => {
        square.mark = "none";
    });
    board.selectedSquare = undefined;
}

export const boardSlice = createSlice({
    name: "board",
    initialState,
    reducers: {
        deselect: (state) => deselectAll(state),
        select: (state, /** @type {PayloadAction<number>} */ action) => {
            if (state.squares.filter(square => square.mark !== "none").length) {
                deselectAll(state);
            } else if (state.selectedSquare === action.payload) {
                state.selectedSquare = undefined;
            } else {
                state.selectedSquare = action.payload;
            }
        },
        mark: (state, /** @type {PayloadAction<{square: number, alt: boolean, ctrl: boolean}>} */ action) => {
            const mark = action.payload.alt ? "alt" : action.payload.ctrl ? "ctrl" : "simple";
            const square = getBySquareIndex(state, action.payload.square);

            if (square.mark === mark) {
                square.mark = "none";
            } else {
                square.mark = mark;
            }
        }
    }
});

export const { select, deselect, mark } = boardSlice.actions;

export const boardReducer = boardSlice.reducer;

