import type { Action, ThunkAction } from "@reduxjs/toolkit";

import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import { connectivitySlice } from "~/features/connectivity/connectivity-slice";
import { phoenixMiddleware } from "~/features/connectivity/phoenix-middleware";
import { synchronizeI18NextMiddleware, userPreferencesSlice } from "~/features/preferences/user-preferences-slice";

// `combineSlices` automatically combines the reducers using
// their `reducerPath`s, therefore we no longer need to call `combineReducers`.
const rootReducer = combineSlices(userPreferencesSlice, connectivitySlice);

export type RootState = ReturnType<typeof rootReducer>;

export const makeStore = (preloadedState?: Partial<RootState>) => {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(phoenixMiddleware, synchronizeI18NextMiddleware.middleware),
  });

  setupListeners(store.dispatch);

  return store;
};

export const store = makeStore();

export type AppStore = typeof store;
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<ThunkReturnType = void> = ThunkAction<ThunkReturnType, RootState, unknown, Action>;
