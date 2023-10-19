import { createSelector, createSlice } from "@reduxjs/toolkit";
import { newPosition } from "./temp";

/**
 * @param {Position} position
 * @param {number} squareIndex
 *
 * @returns {Square}
 */
function getBySquareIndex(position, squareIndex) {
  const index = position.squares.findIndex((square) => square.squareIndex === squareIndex);

  return position.squares[index];
}

/**
 * @param {Position} position
 */
function deselectAll(position) {
  Object.entries(position.squares).forEach(([, square]) => {
    square.mark = "none";
  });
  position.selectedSquare = undefined;
}

/**
 * @typedef {{
 *     id: string,
 *     positions: Position[],
 *     currentPosition: number
 * }} Game
 *
 * @type {{
 *     byId: Record<string, Game>,
 *     allIds: string[],
 *     activeGame: string
 * }}
 */
const initialState = {
  byId: {},
  allIds: [],
  activeGame: "",
};

const gamesSlice = createSlice({
  name: "games",
  initialState,
  reducers: {
    createGame: (state, /** @type {PayloadAction<string>} */ action) => {
      const position = newPosition();
      const game = {
        id: action.payload,
        positions: [position],
        currentPosition: 0,
      };

      state.activeGame = game.id;
      state.byId[game.id] = game;
      state.allIds.push(game.id);
    },

    switchGame: (state, /** @type {PayloadAction<string>} */ action) => {
      state.activeGame = action.payload;
    },

    move: (state, /** @type {PayloadAction<{san: string, squares: Square[]}>} */ action) => {
      const game = state.byId[state.activeGame];

      game.positions.push({
        squares: action.payload.squares,
        selectedSquare: undefined,
      });
      game.currentPosition = game.positions.length - 1;
    },
    deselect: (state) => {
      const game = state.byId[state.activeGame];

      deselectAll(game.positions[game.currentPosition]);
    },
    select: (state, /** @type {PayloadAction<{squareIndex: number}>} */ action) => {
      const game = state.byId[state.activeGame];

      const position = game.positions[game.currentPosition];
      const square = getBySquareIndex(position, action.payload.squareIndex);

      if (!square.piece) {
        deselectAll(position);
      } else if (position.squares.filter((square) => square.mark !== "none" && square.mark !== "highlighted").length) {
        deselectAll(position);
      } else if (position.selectedSquare === action.payload.squareIndex) {
        const square = position.squares.find((square) => square.squareIndex === position.selectedSquare);

        if (square) {
          square.mark = "none";
        }

        position.selectedSquare = undefined;
      } else {
        const square = position.squares.find((square) => square.squareIndex === position.selectedSquare);
        const newSquare = position.squares.find((square) => square.squareIndex === action.payload.squareIndex);

        if (square) {
          square.mark = "none";
        }

        if (newSquare) {
          newSquare.mark = "highlighted";
        }
        position.selectedSquare = action.payload.squareIndex;
      }
    },
    mark: (state, /** @type {PayloadAction<{squareIndex: number, alt: boolean, ctrl: boolean}>} */ action) => {
      const game = state.byId[state.activeGame];
      const mark = action.payload.alt ? "alt" : action.payload.ctrl ? "ctrl" : "simple";

      const position = game.positions[game.currentPosition];
      const square = getBySquareIndex(position, action.payload.squareIndex);

      if (square.mark === mark) {
        square.mark = "none";
      } else {
        square.mark = mark;
      }
    },
    unmark: (state, /** @type {PayloadAction<{squareIndex: number}>} */ action) => {
      const game = state.byId[state.activeGame];

      const position = game.positions[game.currentPosition];
      const square = getBySquareIndex(position, action.payload.squareIndex);
      square.mark = "none";
    },
  },
});

export const { createGame, switchGame, move, deselect, select, mark, unmark } = gamesSlice.actions;

export const gamesReducer = gamesSlice.reducer;

export const selectCurrentGame = createSelector(
  (/** @type {import("@/store").RootState} */ state) => state.games.byId,
  (/** @type {import("@/store").RootState} */ state) => state.games.activeGame,
  (byId, gameId) => byId[gameId],
);

export const selectCurrentPosition = (/** @type {import("@/store").RootState} */ state) => {
  // @ts-ignore
  const game = selectCurrentGame(state);

  if (game) {
    return game.positions[game.currentPosition];
  }

  return undefined;
};
