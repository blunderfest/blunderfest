import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { socketMiddleware } from "./features/connectivity/socketMiddleware";
import { rootReducer } from "./store/rootReducer";

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
