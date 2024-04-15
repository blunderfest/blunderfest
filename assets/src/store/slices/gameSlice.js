import { move } from "@/store/actions/move";
import { createSlice } from "@reduxjs/toolkit";
import { joined } from "../actions/joined";

/**
 * @typedef {Object} State
 * @property {Record<string, Game>} gamesByCode
 * @property {Record<string, Variation>} variationsByGame
 */

/**
 * @type {State}
 */
const initialState = {
  gamesByCode: {},
  variationsByGame: {},
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(joined, (state, action) => {
      state.gamesByCode = action.payload.gamesByCode;
      state.variationsByGame = action.payload.games.reduce((prev, game) => ({ ...prev, [game]: [] }), {});
    });

    builder.addCase(move, (state, action) => {
      state.variationsByGame[action.payload.gameCode] = action.payload.move.variationPath;
    });
  },
  selectors: {
    selectCurrentVariation: (state, gameCode) => state.variationsByGame[gameCode],
  },
});

export const gameReducer = gameSlice.reducer;
export const { selectCurrentVariation } = gameSlice.selectors;
