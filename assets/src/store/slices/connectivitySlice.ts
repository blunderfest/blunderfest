import { userSocket } from "@/features/connectivity/socket";
import { createAppSlice } from "@/store/createAppSlice";
import { createAsyncThunk } from "@reduxjs/toolkit";

const initialState: {
  status: "connecting" | "connected" | "disconnected";
} = {
  status: "disconnected",
};

export const connect = createAsyncThunk("connectivity/connect", () => userSocket.connect());
export const disconnect = createAsyncThunk("connectivity/disconnect", () => userSocket.disconnect());

export const connectivitySlice = createAppSlice({
  name: "connectivity",
  initialState,

  reducers: {},
  extraReducers(builder) {
    builder.addCase(connect.pending, (state) => {
      state.status = "connecting";
    });

    builder.addCase(connect.fulfilled, (state) => {
      state.status = "connected";
    });

    builder.addCase(disconnect.fulfilled, (state) => {
      state.status = "disconnected";
    });
  },
});
