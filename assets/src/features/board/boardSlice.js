import { createSlice } from "@reduxjs/toolkit";

const files = [...Array.from({ length: 8 }).keys()];
const ranks = [...Array.from({ length: 8 }).keys()].reverse();

/** @type {Array<Piece | undefined>} */
const pieces = [...Array.from({ length: 64 }).keys()].map((square_index) => {
	switch (square_index) {
		case 0:
			return { color: "white", piece: "rook" };
		case 1:
			return { color: "white", piece: "knight" };
		case 2:
			return { color: "white", piece: "bishop" };
		case 3:
			return { color: "white", piece: "queen" };
		case 4:
			return { color: "white", piece: "king" };
		case 5:
			return { color: "white", piece: "bishop" };
		case 6:
			return { color: "white", piece: "knight" };
		case 7:
			return { color: "white", piece: "rook" };

		case 8:
			return { color: "white", piece: "pawn" };
		case 9:
			return { color: "white", piece: "pawn" };
		case 10:
			return { color: "white", piece: "pawn" };
		case 11:
			return { color: "white", piece: "pawn" };
		case 12:
			return { color: "white", piece: "pawn" };
		case 13:
			return { color: "white", piece: "pawn" };
		case 14:
			return { color: "white", piece: "pawn" };
		case 15:
			return { color: "white", piece: "pawn" };

		case 56:
			return { color: "black", piece: "rook" };
		case 57:
			return { color: "black", piece: "knight" };
		case 58:
			return { color: "black", piece: "bishop" };
		case 59:
			return { color: "black", piece: "queen" };
		case 60:
			return { color: "black", piece: "king" };
		case 61:
			return { color: "black", piece: "bishop" };
		case 62:
			return { color: "black", piece: "knight" };

		case 63:
			return { color: "black", piece: "rook" };
		case 48:
			return { color: "black", piece: "pawn" };
		case 49:
			return { color: "black", piece: "pawn" };
		case 50:
			return { color: "black", piece: "pawn" };
		case 51:
			return { color: "black", piece: "pawn" };
		case 52:
			return { color: "black", piece: "pawn" };
		case 53:
			return { color: "black", piece: "pawn" };
		case 54:
			return { color: "black", piece: "pawn" };
		case 55:
			return { color: "black", piece: "pawn" };
		default: {
			return undefined;
		}
	}
});

/**
 * @typedef {{
 *   square_index: number,
 *   color: "light" | "dark"
 *   mark: "none" | "simple" | "alt" | "ctrl",
 *   piece?: Piece
 * }} Square
 *
 * @typedef {{
 *   squares: Square[],
 *   selectedSquare?: number,
 * }} Board
 */

const initialState = /** @type Board */ ({
	squares: ranks.flatMap((rank) =>
		files.map((file) => ({
			square_index: rank * 8 + file,
			color: file % 2 === rank % 2 ? "light" : "dark",
			mark: "none",
			piece: pieces[rank * 8 + file],
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
	const index = board.squares.findIndex((square) => square.square_index === square_index);

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
			const square = getBySquareIndex(state, action.payload);

			if (!square.piece) {
				deselectAll(state);
			} else if (state.squares.filter((square) => square.mark !== "none").length) {
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
		},
	},
});

export const { select, deselect, mark } = boardSlice.actions;

export const boardReducer = boardSlice.reducer;
