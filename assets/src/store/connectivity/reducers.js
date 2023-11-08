import { createReducer } from "@reduxjs/toolkit";
import { connected, disconnected } from "./actions";

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

export const connectivityReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(connected, (state, action) => {
      const { roomCode, userId } = action.payload;

      state.roomCode = roomCode;
      state.userId = userId;
      state.status = "online";
    })
    .addCase(disconnected, (state) => {
      state.status = "offline";
    });
});
