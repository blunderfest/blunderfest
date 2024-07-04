import { connected, disconnected } from "@/store/actions";
import { createSlice } from "@reduxjs/toolkit";

type State = {
  userId: string;
  connectionStatus: "connected" | "disconnected";
};

const initialState: State = {
  userId: "",
  connectionStatus: "disconnected",
};

export const connectivitySlice = createSlice({
  name: "connectivity",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(connected, (state, action) => {
        state.userId = action.payload.userId;
        state.connectionStatus = "connected";
      })
      .addCase(disconnected, (state) => {
        state.connectionStatus = "disconnected";
      });
  },
});
