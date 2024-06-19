import { configureStore } from "@reduxjs/toolkit";
import { counterSlice } from "@/features/counter/counterSlice";
import { socketMiddleware } from "@/features/connectivity/socketMiddleware";
import { useDispatch, useSelector } from "react-redux";

export const store = configureStore({
  reducer: {
    counter: counterSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(socketMiddleware),
});

/**
 * @typedef {ReturnType<typeof store.getState>} RootState
 */

/**
 * @typedef {typeof store.dispatch} AppDispatch
 */

/**
 * @type {import("react-redux").UseDispatch<AppDispatch>}
 */
export const useAppDispatch = useDispatch;

/**
 * @type {import("react-redux").UseSelector<RootState>}
 */
export const useAppSelector = useSelector;
