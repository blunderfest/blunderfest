import { parseFen } from "@/features/parsers/parseFen";
import { createEntityAdapter, createReducer } from "@reduxjs/toolkit";
import { deselectSquare, gameAdded, pieceMoved, resetPosition, selectSquare } from "./actions";

/**
 * @typedef {{positionId: string, selectedSquareIndex: number?, arrows: Arrow[]} & ParsedPosition} Position
 * @type {import("@reduxjs/toolkit").EntityAdapter<Position>}
 */
const positionAdapter = createEntityAdapter({
  selectId: (position) => position.positionId,
});

/**
 * @param {PositionFromServer} positionFromServer
 * @returns {Position}
 */
function convert(positionFromServer) {
  return {
    positionId: positionFromServer.positionId,
    selectedSquareIndex: positionFromServer.selectedSquareIndex,
    arrows: positionFromServer.arrows,
    ...parseFen(positionFromServer.fen),
  };
}

export const positionReducer = createReducer(positionAdapter.getInitialState(), (builder) => {
  builder
    .addCase(selectSquare, (state, action) => {
      const { positionId, squareIndex } = action.payload;

      positionAdapter.updateOne(state, {
        id: positionId,
        changes: {
          selectedSquareIndex: squareIndex,
        },
      });
    })
    .addCase(deselectSquare, (state, action) => {
      const { positionId } = action.payload;

      positionAdapter.updateOne(state, {
        id: positionId,
        changes: {
          selectedSquareIndex: null,
        },
      });
    })
    .addCase(resetPosition, (state, action) => {
      const positionId = action.payload;
      const position = state.entities[positionId];

      if (position) {
        positionAdapter.updateOne(state, {
          id: positionId,
          changes: {
            selectedSquareIndex: null,
          },
        });
      }
    })
    .addCase(gameAdded, (state, action) => {
      positionAdapter.addOne(state, convert(action.payload.position));
    })
    .addCase(pieceMoved, (state, action) => {
      positionAdapter.addOne(state, convert(action.payload.position));
    });
});

export const { selectById } = positionAdapter.getSelectors((/** @type {import(".").RootState} */ state) => state.position);
