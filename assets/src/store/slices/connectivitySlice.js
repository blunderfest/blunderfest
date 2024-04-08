import { createSlice } from "@reduxjs/toolkit";
import { connect } from "../actions/connect";
import { connected } from "../actions/connected";
import { disconnected } from "../actions/disconnected";

/**
 * @typedef {Object} State
 * @property {"connected" | "disconnected" | "connecting"} status
 */

/**
 * @type {State}
 */
const initialState = {
  status: "connected",
};

export const connectivitySlice = createSlice({
  name: "connectivity",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(connect, (state) => {
      state.status = "connecting";
    });

    builder.addCase(connected, (state) => {
      state.status = "connected";
    });

    builder.addCase(disconnected, (state) => {
      state.status = "disconnected";
    });
  },
});

export const connectivityReducer = connectivitySlice.reducer;
