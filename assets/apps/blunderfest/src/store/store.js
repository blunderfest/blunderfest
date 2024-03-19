import { combineReducers, configureStore, createAction, createSlice } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

const initialState = {
  count: 0,
};

export const incrementBy = createAction(
  "incrementBy",
  /**
   * @param {number} amount
   */
  (amount) => ({
    payload: amount,
  })
);

const counterSlice = createSlice({
  name: "counter",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(incrementBy, (state, action) => {
      state.count += action.payload;
    });
  },
});

const counterReducer = counterSlice.reducer;

const rootReducer = combineReducers({
  counter: counterReducer,
});

export const store = configureStore({
  reducer: rootReducer,
});

/**
 * @typedef {ReturnType<typeof rootReducer>} RootState
 * @typedef {typeof store.dispatch} AppDispatch
 * @typedef {import("react-redux").TypedUseSelectorHook<RootState>} AppSelector
 */

/**
 * @type {() => AppDispatch}
 */
export const useAppDispatch = useDispatch;

/**
 * @type {AppSelector}
 */
export const useAppSelector = useSelector;
