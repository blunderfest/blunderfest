import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { boardReducer } from "./features/board/boardSlice";
import { connectivityReducer } from "./features/connectivity/connectivitySlice";
import { presenceReducer } from "./features/connectivity/presenceSlice";
import { socketMiddleware } from "./features/connectivity/socketMiddleware";

export const store = configureStore({
	reducer: {
		board: boardReducer,
		presence: presenceReducer,
		connectivity: connectivityReducer,
	},
	middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(socketMiddleware),
});

/**
 * @typedef {ReturnType<typeof store.getState>} RootState
 */

/**
 * @typedef {typeof store.dispatch} AppDispatch
 */

// Use throughout your app instead of plain `useDispatch` and `useSelector`

/**
 * @type {() => AppDispatch}
 */
export const useAppDispatch = useDispatch;

/**
 * @type {import('react-redux').TypedUseSelectorHook<RootState>}
 */
export const useAppSelector = useSelector;
