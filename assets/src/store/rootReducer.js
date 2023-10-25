import { combineReducers } from "@reduxjs/toolkit";
import { connectivityReducer } from "./connectivity/reducers";
import { gameReducer } from "./games";
import { positionReducer } from "./positions";
import { roomReducer } from "./room/reducers";

export const rootReducer = combineReducers({
  room: roomReducer,
  game: gameReducer,
  position: positionReducer,
  connectivity: connectivityReducer,
});
