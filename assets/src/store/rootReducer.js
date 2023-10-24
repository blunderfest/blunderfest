import { combineReducers } from "@reduxjs/toolkit";
import { boardReducer } from "./board/reducers";
import { connectivityReducer } from "./connectivity/reducers";
import { gameReducer } from "./games";
import { roomReducer } from "./room/reducers";

export const rootReducer = combineReducers({
  room: roomReducer,
  game: gameReducer,
  board: boardReducer,
  connectivity: connectivityReducer,
});
