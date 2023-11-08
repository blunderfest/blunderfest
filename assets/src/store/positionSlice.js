import { createSlice } from "@reduxjs/toolkit";
import { moved } from "./gameSlice";
import { gameAdded } from "./roomSlice";

/**
 * @type {{
 *   byId: Record<string, Position>,
 *   currentPositions: Record<string, string>
 * }}
 */
const initialState = {
  byId: {},
  currentPositions: {},
};

const flattenPositions =
  /**
   * @param {GameNode} node
   */
  (node) => {
    const flat = [node.position];

    node.variations.forEach((variation) => {
      flat.push(...flattenPositions(variation));
    });

    return flat;
  };

const positionSlice = createSlice({
  name: "position",
  initialState,
  reducers: {
    select: (state, /** @type {PayloadAction<{positionId: String, squareIndex: Number}>} */ action) => {
      const { positionId, squareIndex } = action.payload;
      const position = state.byId[positionId];

      if (position.selectedSquareIndex === squareIndex) {
        position.selectedSquareIndex = null;
      } else {
        position.selectedSquareIndex = squareIndex;
      }
    },
    reset: (state, /** @type {PayloadAction<string>} */ action) => {
      const positionId = action.payload;
      const position = state.byId[positionId];

      position.selectedSquareIndex = null;
      position.arrows = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(gameAdded, (state, action) => {
        const positions = flattenPositions(action.payload);
        positions.forEach((position) => (state.byId[position.id] = position));
        state.currentPositions[action.payload.id] = action.payload.position.id;
      })
      .addCase(moved, (state, action) => {
        const { id, positionId, ply, fen } = action.payload;
        state.byId[positionId] = {
          id: positionId,
          arrows: [],
          selectedSquareIndex: 0,
          ply: ply,
          fen: fen,
        };
        state.currentPositions[id] = positionId;
      });
  },
});

export const { select, reset } = positionSlice.actions;
export const positionReducer = positionSlice.reducer;
