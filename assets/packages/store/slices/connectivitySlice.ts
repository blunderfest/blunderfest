import { PayloadAction, createSlice } from "@reduxjs/toolkit";

type State = {
  status: "online" | "offline" | "connecting";
  roomCode: string;
  userToken: string;
};

const initialState: State = {
  status: "offline",
  roomCode: "",
  userToken: "",
};

const connectivitySlice = createSlice({
  name: "connectivity",
  initialState,
  reducers: {
    connect: (state, _action: PayloadAction<{ roomCode: string; userToken: string }>) => {
      state.status = "connecting";
    },
    connected: (state) => {
      state.status = "online";
    },
    disconnect: (state) => {
      state.status = "offline";
    },
    joined: (state, action: PayloadAction<{ roomCode: string; userToken: string }>) => {
      state.roomCode = action.payload.roomCode;
      state.userToken = action.payload.userToken;
    },
    left: (state) => {
      state.roomCode = "";
    },
  },
});

export const connectivityReducer = connectivitySlice.reducer;
export const { connect, connected, joined, left } = connectivitySlice.actions;
