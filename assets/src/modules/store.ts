import { connectivityReducer } from "~/modules/connectivity";

import { combineReducers, configureStore } from "@reduxjs/toolkit";

import { phoenixMiddleware } from "./connectivity/phoenixMiddleware";

const rootReducer = combineReducers({ connectivity: connectivityReducer });

export const store = configureStore({
    reducer: rootReducer,
    middleware(getDefaultMiddleware) {
        return getDefaultMiddleware().concat(phoenixMiddleware);
    },
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
