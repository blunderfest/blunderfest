import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { connectivityReducer } from "./connectivity";
import { gameReducer } from "./games";
import { marksReducer } from "./marks/reducers";
import { socketMiddleware } from "./middlewares/socketMiddleware";
import { positionReducer } from "./positions";
import { roomReducer } from "./room";

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
