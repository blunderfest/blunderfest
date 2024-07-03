import { configureStore, combineReducers, bindActionCreators } from "@reduxjs/toolkit";
import { socketMiddleware } from "../features/connectivity/socketMiddleware";
import { connectivitySlice } from "@/features/connectivity/connectivitySlice";
import { roomSlice } from "@/features/room/roomSlice";
import { boardSlice } from "@/features/board/boardSlice";
import * as allActions from "./actions";

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

export const actions = bindActionCreators(allActions, store.dispatch);
