import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { boardReducer } from "./features/board/boardSlice";
import { connectivityReducer } from "./features/connectivity/connectivitySlice";
import { presenceReducer } from "./features/connectivity/presenceSlice";
import { socketMiddleware } from "./features/connectivity/socketMiddleware";

const rootReducer = combineReducers({
  board: boardReducer,
  system: combineReducers({ presence: presenceReducer, connectivity: connectivityReducer }),
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
