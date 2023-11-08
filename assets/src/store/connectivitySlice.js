import { createSlice } from "@reduxjs/toolkit";
/**
 * @type {{
 *   status: "offline" | "online",
 *   roomCode: string?,
 *   userId: string?
 * }}
 */
const initialState = {
  status: "offline",
  roomCode: null,
  userId: null,
};

const connectivitySlice = createSlice({
  name: "connectivity",
  initialState,
  reducers: {
    connected: (state, /** @type {PayloadAction<{userId: String, roomCode: String}>} */ action) => {
      state.roomCode = action.payload.roomCode;
      state.userId = action.payload.userId;
      state.status = "online";
    },
    disconnected: (state) => {
      state.status = "offline";
    },
  },
});

export const { connected, disconnected } = connectivitySlice.actions;
export const connectivityReducer = connectivitySlice.reducer;
