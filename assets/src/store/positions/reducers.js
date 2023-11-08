import { createReducer } from "@reduxjs/toolkit";
import { moved } from "../games";
import { reset, select } from "../positions";
import { addGame } from "../room";

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

export const positionReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(addGame, (state, action) => {
      const positions = flattenPositions(action.payload);
      positions.forEach((position) => (state.byId[position.id] = position));
      state.currentPositions[action.payload.id] = action.payload.position.id;
    })
    .addCase(moved, (state, action) => {
      const { gameId, positionId, ply, fen } = action.payload;
      state.byId[positionId] = {
        id: positionId,
        arrows: [],
        selectedSquareIndex: 0,
        ply: ply,
        fen: fen,
      };
      state.currentPositions[gameId] = positionId;
    })
    .addCase(reset, (state, action) => {
      const { positionId } = action.payload;
      const position = state.byId[positionId];

      position.selectedSquareIndex = null;
      position.arrows = [];
    })
    .addCase(select, (state, action) => {
      const { positionId, squareIndex } = action.payload;
      const position = state.byId[positionId];

      if (position.selectedSquareIndex === squareIndex) {
        position.selectedSquareIndex = null;
      } else {
        position.selectedSquareIndex = squareIndex;
      }
    });
});
