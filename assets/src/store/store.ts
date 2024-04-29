import { configureStore } from "@reduxjs/toolkit";
import { boardSlice } from "./slices/boardSlice";
import { gameSlice } from "./slices/gameSlice";
import { roomSlice } from "./slices/roomSlice";
import { socketSlice, websocketMiddleware } from "./slices/socketSlice";

export const store = configureStore({
  reducer: {
    [socketSlice.reducerPath]: socketSlice.reducer,
    [roomSlice.reducerPath]: roomSlice.reducer,
    [boardSlice.reducerPath]: boardSlice.reducer,
    [gameSlice.reducerPath]: gameSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(websocketMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
