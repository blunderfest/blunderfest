import { createSlice } from "@reduxjs/toolkit";
import { connected } from "../connectivity/connectivitySlice";

/**
 * @type {{
 *     roomCode?: string,
 *     userId?: string,
 * }}
 */
const initialState = {
  roomCode: undefined,
  userId: undefined,
};

const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {
    joined: (state, /** @type {PayloadAction<{roomCode: string, userId: string}>} */ action) => {
      state.roomCode = action.payload.roomCode;
      state.userId = action.payload.userId;
    },
  },
  extraReducers(builder) {
    builder.addCase(connected, (state, action) => {
      state.userId = action.payload.userId;
      state.roomCode = action.payload.roomCode;
    });
  },
});

export const { joined } = roomSlice.actions;

export const roomReducer = roomSlice.reducer;
