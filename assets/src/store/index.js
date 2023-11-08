import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { connectivityReducer } from "./connectivitySlice";
import { gameReducer } from "./gameSlice";
import { marksReducer } from "./markSlice";
import { positionReducer } from "./positionSlice";
import { roomReducer } from "./roomSlice";
import { socketMiddleware } from "./socketMiddleware";

const rootReducer = combineReducers({
  room: roomReducer,
  game: gameReducer,
  position: positionReducer,
  marks: marksReducer,
  connectivity: connectivityReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(socketMiddleware),
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
 * @type {import('react-redux').TypedUseSelectorHook<RootState>}
 */
export const useAppSelector = useSelector;
