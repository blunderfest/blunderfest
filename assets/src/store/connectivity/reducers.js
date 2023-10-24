import { createReducer } from "@reduxjs/toolkit";
import { connect, disconnect } from "./actions";

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
    .addCase(connect, (state, action) => {
      const { roomCode, userId } = action.payload;

      state.roomCode = roomCode;
      state.userId = userId;
      state.status = "online";
    })
    .addCase(disconnect, (state) => {
      state.status = "offline";
    });
});
