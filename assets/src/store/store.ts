import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { boardReducer } from "./slices/boardSlice";
import { connectivityReducer } from "./slices/connectivitySlice";
import { gameReducer } from "./slices/gameSlice";
import { roomReducer } from "./slices/roomSlice";
import { websocketMiddleware } from "./websockets/websocketMiddleware";

export const store = configureStore({
  reducer: {
    board: boardReducer,
    connectivity: connectivityReducer,
    room: roomReducer,
    game: gameReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(websocketMiddleware),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
