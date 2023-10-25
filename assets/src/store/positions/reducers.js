import { createReducer } from "@reduxjs/toolkit";
import { move } from "../games";
import { mark, reset, select } from "../positions";
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
    .addCase(move, (state, action) => {
      const { gameId, variation } = action.payload;

      state.byId[variation.position.id] = variation.position;
      state.currentPositions[gameId] = variation.position.id;
    })
    .addCase(mark, (state, action) => {
      const { positionId, squareIndex, mark } = action.payload;
      const position = state.byId[positionId];

      if (position.marks[squareIndex] === mark) {
        position.marks[squareIndex] = "none";
      } else {
        position.marks[squareIndex] = mark;
      }
    })
    .addCase(reset, (state, action) => {
      const { positionId } = action.payload;
      const position = state.byId[positionId];

      position.selectedSquareIndex = null;
      position.arrows = [];
      position.marks = [...Array.from({ length: 64 })].map(() => "none");
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
