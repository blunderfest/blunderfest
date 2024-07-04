import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { socketMiddleware } from "@/features/connectivity/socketMiddleware";
import { connectivitySlice } from "@/features/connectivity/connectivitySlice";
import { roomSlice } from "@/features/room/roomSlice";
import { boardSlice } from "@/features/board/boardSlice";
import { UseSelector, useDispatch, useSelector } from "react-redux";

const rootReducer = combineReducers({
  [connectivitySlice.reducerPath]: connectivitySlice.reducer,
  [roomSlice.reducerPath]: roomSlice.reducer,
  [boardSlice.reducerPath]: boardSlice.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat([socketMiddleware]),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector: UseSelector<RootState> = useSelector;
