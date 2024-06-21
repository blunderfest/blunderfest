import { connected } from "@/store/actions";
import { createSlice } from "@reduxjs/toolkit";

export const connectivitySlice = createSlice({
  name: "connectivity",
  initialState: {
    userId: "",
  },
  reducers: {},
  extraReducers(builder) {
    builder.addCase(connected, (state, action) => {
      state.userId = action.payload.userId;
    });
  },
});
