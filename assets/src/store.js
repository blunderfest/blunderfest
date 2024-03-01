import { combineReducers, configureStore, createSlice } from "@reduxjs/toolkit";
import { decrement } from "./actions/decrement";
import { increment } from "./actions/increment";
import { incrementByAmount } from "./actions/incrementByAmount";
import { websocketMiddleware } from "./connectivity/middlewares/websocketMiddleware";

import { connectivityReducer } from "connectivity/connectivityReducer";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from "redux-persist";
import storage from "redux-persist/lib/storage";

const counterSlice = createSlice({
  name: "counter",
  initialState: {
    value: 0,
  },
  reducers: [],
  extraReducers: (builder) => {
    builder
      .addCase(increment, (state) => {
        state.value += 1;
      })
      .addCase(decrement, (state) => {
        state.value -= 1;
      })
      .addCase(incrementByAmount, (state, action) => {
        state.value += action.payload.amount;
      });
  },
  selectors: {
    selectCount: (state) => state.value,
  },
});

export const { selectCount } = counterSlice.selectors;

const rootReducer = combineReducers({
  counter: counterSlice.reducer,
  connectivity: connectivityReducer,
});

const persistConfig = {
  key: "root",
  storage: storage,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(websocketMiddleware),
});

export const persistor = persistStore(store);
