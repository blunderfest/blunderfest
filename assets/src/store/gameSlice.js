import { createSlice } from "@reduxjs/toolkit";
import { gameAdded } from "./roomSlice";

/**
 * @type {{
 *   byId: Record<string, Game>,
 *   allIds: string[]
 * }}
 */
const initialState = {
  byId: {},
  allIds: [],
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    move: (
      state,
      /** @type {PayloadAction<{
       *   gameId: String,
       *   positionId: String,
       *   move: Move
       * }>} */ action,
    ) => {},
    moved: (
      state,
      /** @type {PayloadAction<{id: String, positionId: String, ply: Number, fen: String, move: Move}>} */ action,
    ) => {
      const game = state.byId[action.payload.id];
      const position = /** @type {Position} */ ({
        id: action.payload.positionId,
        fen: action.payload.fen,
        arrows: [],
        marks: [],
        ply: action.payload.ply,
        selectedSquareIndex: 0,
      });

      const variation = /** @type {Variation} */ ({
        position: position,
        move: action.payload.move,
        variations: [],
      });

      game.variations.push(variation);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(gameAdded, (state, action) => {
      state.allIds.push(action.payload.id);
      state.byId[action.payload.id] = action.payload;
    });
  },
});

export const { move, moved } = gameSlice.actions;
export const gameReducer = gameSlice.reducer;
