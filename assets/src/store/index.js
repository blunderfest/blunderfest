import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { counterSlice } from "@/features/counter/counterSlice";
import { socketMiddleware } from "./socketMiddleware";
import { connectivitySlice } from "@/features/connectivity/connectivitySlice";
import { roomSlice } from "@/features/room/roomSlice";
import { appendUserIdMiddleware } from "./appendUserIdMiddleware";

const rootReducer = combineReducers({
  [counterSlice.reducerPath]: counterSlice.reducer,
  [connectivitySlice.reducerPath]: connectivitySlice.reducer,
  [roomSlice.reducerPath]: roomSlice.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat([appendUserIdMiddleware, socketMiddleware]),
});

/**
 * @typedef {ReturnType<typeof rootReducer>} RootState
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
