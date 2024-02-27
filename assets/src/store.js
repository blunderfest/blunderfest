import { configureStore, createAction, createSlice } from "@reduxjs/toolkit";

export const increment = createAction("increment");
export const decrement = createAction("decrement");
export const incrementByAmount = createAction(
  "incrementByAmount",
  /**
   * @param {number} amount
   */
  (amount) => ({
    payload: {
      amount: amount,
    },
  })
);

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
});

export const store = configureStore({
  reducer: {
    counter: counterSlice.reducer,
  },
});

export const selectCount = (state) => state.counter.value;
