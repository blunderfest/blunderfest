import { createSlice } from "@reduxjs/toolkit";

/**
 * @type {{
 *     status: "offline" | "online",
 *     roomCode: string | undefined,
 *     userId: string | undefined
 * }}
 */
const initialState = {
	status: "offline",
	roomCode: undefined,
	userId: undefined,
};

export const connectivitySlice = createSlice({
	name: "system/connectivity",
	initialState,
	reducers: {
		connected: (state, /** @type {PayloadAction<{userId: String, roomCode: string}>} */ action) => {
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
