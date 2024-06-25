import { configureStore, combineReducers } from "@reduxjs/toolkit";
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

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
