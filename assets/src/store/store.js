import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { boardReducer } from "./slices/boardSlice";
import { connectivityReducer } from "./slices/connectivitySlice";
import { gameReducer } from "./slices/gameSlice";
import { roomReducer } from "./slices/roomSlice";
import { websocketMiddleware } from "./websocketMiddleware";

const rootReducer = combineReducers({
  connectivity: connectivityReducer,
  room: roomReducer,
  game: gameReducer,
  board: boardReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(websocketMiddleware),
});

/**
 * @typedef {ReturnType<typeof store.getState>} RootState
 * @typedef {typeof store.dispatch} AppDispatch
 */

/**
 * @type {() => AppDispatch}
 */
export const useAppDispatch = useDispatch;

/**
 * @type {import("react-redux").UseSelector<RootState>}
 */
export const useAppSelector = useSelector;
