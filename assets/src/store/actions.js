import { createAction, createAsyncThunk } from "@reduxjs/toolkit";

export const connect = createAction("connect");
export const connected = createAction("connected");

export const increment = createAction("counter/increment");
export const decrement = createAction("counter/decrement");
export const incrementByAmount = createAction(
  "counter/incrementByAmount",
  /**
   * @param {} amount
   */
  (amount) => ({
    payload: {
      amount: amount,
    },
  })
);
