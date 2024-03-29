import { connect, connected, disconnected } from "@/actions/joined";
import { createSlice } from "@reduxjs/toolkit";

type State = {
  status: "connected" | "disconnected" | "connecting";
  userToken: string;
};

const initialState: State = {
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
