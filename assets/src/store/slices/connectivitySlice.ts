import { connect, connected, disconnected } from "@/actions/joined";
import { createSlice } from "@reduxjs/toolkit";

type State = {
  status: "online" | "offline" | "connecting";
  userToken: string;
};

const initialState: State = {
  status: "offline",
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
      state.status = "online";
      state.userToken = action.payload.userToken;
    });

    builder.addCase(disconnected, (state) => {
      state.status = "offline";
    });
  },
});

export const connectivityReducer = connectivitySlice.reducer;
