import { configureStore } from "@reduxjs/toolkit";
import { boardSlice } from "./slices/boardSlice";
import { gameSlice } from "./slices/gameSlice";
import { roomSlice } from "./slices/roomSlice";
import { connectivitySlice } from "./slices/connectivitySlice";
import { websocketMiddleware } from "./websocketMiddleware";

export const store = configureStore({
  reducer: {
    [connectivitySlice.reducerPath]: connectivitySlice.reducer,
    [roomSlice.reducerPath]: roomSlice.reducer,
    [boardSlice.reducerPath]: boardSlice.reducer,
    [gameSlice.reducerPath]: gameSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(websocketMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
