import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { websocketMiddleware } from "./connectivity";

import { useDispatch, useSelector, useStore } from "react-redux";
import { connectivityReducer } from "./connectivity/connectivityReducer";
import { gameReducer } from "./games";
import { roomReducer } from "./rooms";

const rootReducer = combineReducers({
    connectivity: connectivityReducer,
    rooms: roomReducer,
    games: gameReducer,
});

export const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(websocketMiddleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
