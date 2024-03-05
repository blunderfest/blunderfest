import { combineReducers, configureStore, createSlice } from '@reduxjs/toolkit';
import { decrement } from './actions/decrement';
import { increment } from './actions/increment';
import { incrementByAmount } from './actions/incrementByAmount';
import { websocketMiddleware } from './connectivity/middlewares/websocketMiddleware';

import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { connectivityReducer } from './connectivity/connectivityReducer';

const counterSlice = createSlice({
  name: 'counter',
  initialState: {
    value: 0,
  },
  reducers: {},
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
  key: 'root',
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

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof persistedReducer>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
