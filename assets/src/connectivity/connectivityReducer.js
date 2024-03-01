import { createSlice } from "@reduxjs/toolkit";
import { connected } from "./actions/connected";
import { disconnected } from "./actions/disconnected";
import { joined } from "./actions/joined";
import { left } from "./actions/left";

const connectivitySlice = createSlice({
  name: "connectivity",
  initialState: {
    online: false,
    rooms: [],
    userId: "",
  },
  reducers: [],
  extraReducers: (builder) => {
    builder
      .addCase(connected, (state) => {
        state.online = true;
      })
      .addCase(disconnected, (state) => {
        state.online = false;
      })
      .addCase(joined, (state, action) => {
        state.rooms.push(action.payload.roomCode);
        state.userId = action.payload.userId;
      })
      .addCase(left, (state, action) => {
        state.rooms = state.rooms.filter(
          (room) => room !== action.payload.roomCode
        );
      });
  },
});

export const connectivityReducer = connectivitySlice.reducer;
