import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { counterSlice } from "@/features/counter/counterSlice";
import { socketMiddleware } from "./socketMiddleware";
import { connectivitySlice } from "@/features/connectivity/connectivitySlice";
import { roomSlice } from "@/features/room/roomSlice";

const rootReducer = combineReducers({
  [counterSlice.reducerPath]: counterSlice.reducer,
  [connectivitySlice.reducerPath]: connectivitySlice.reducer,
  [roomSlice.reducerPath]: roomSlice.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat([socketMiddleware]),
});

/**
 * @typedef {ReturnType<typeof rootReducer>} RootState
 * @typedef {typeof store.dispatch} AppDispatch
 */

export const useAppDispatch = () => {
  const dispatch = useDispatch();

  return function d(/** @type {import("@reduxjs/toolkit").UnknownAction} */ action) {
    const userId = store.getState().connectivity.userId;

    return dispatch({
      ...action,
      meta: {
        source: userId,
      },
    });
  };
};

/**
 * @type {import("react-redux").UseSelector<RootState>}
 */
export const useAppSelector = useSelector;
