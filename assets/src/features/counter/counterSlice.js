import { decrement, increment, incrementByAmount } from "@/store/actions";
import { createSlice } from "@reduxjs/toolkit";

export const counterSlice = createSlice({
  name: "counter",
  initialState: {
    value: 0,
  },
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(increment, (state) => {
        state.value++;
      })
      .addCase(decrement, (state) => {
        state.value--;
      })
      .addCase(incrementByAmount, (state, action) => {
        state.value += action.payload.amount;
      });
  },
});
