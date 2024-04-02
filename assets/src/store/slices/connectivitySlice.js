import { createSlice } from "@reduxjs/toolkit";
import { connect } from "../actions/connect";
import { connected } from "../actions/connected";
import { disconnected } from "../actions/disconnected";

/**
 * @typedef {Object} State
 * @property {"connected" | "disconnected" | "connecting"} status
 * @property {string} userToken
 */

/**
 * @type {State}
 */
const initialState = {
  status: "connected",
  userToken: "",
};

export const connectivitySlice = createSlice({
  name: "connectivity",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder.addCase(connect, (state) => {
      state.status = "connecting";
    });

    builder.addCase(connected, (state, action) => {
      state.status = "connected";
      state.userToken = action.payload.userToken;
    });

    builder.addCase(disconnected, (state) => {
      state.status = "disconnected";
    });
  },
});

export const connectivityReducer = connectivitySlice.reducer;
