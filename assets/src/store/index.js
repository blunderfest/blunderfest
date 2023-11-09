import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { connectivityReducer } from "./connectivityReducer";
import { gameReducer } from "./gameReducer";
import { markReducer } from "./markReducer";
import { positionReducer } from "./positionReducer";
import { roomReducer } from "./roomReducer";
import { socketMiddleware } from "./socketMiddleware";
import { variationReducer } from "./variationReducer";

const rootReducer = combineReducers({
  room: roomReducer,
  game: gameReducer,
  position: positionReducer,
  variation: variationReducer,
  marks: markReducer,
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
