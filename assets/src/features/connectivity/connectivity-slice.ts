import { type PayloadAction } from "@reduxjs/toolkit";

import { createAppSlice } from "~/app/create-app-slice";

type ConnectivitySliceState = {
  state: "connected" | "connecting" | "disconnected";
  userId: string;
  room: {
    roomCode: string;
    users: {
      id: string;
      metas: {
        phxRef: string;
        onlineAt: string;
      }[];
    }[];
  };
};

const initialState: ConnectivitySliceState = {
  state: "disconnected",
  userId: "",
  room: {
    roomCode: "",
    users: [],
  },
};

export const connectivitySlice = createAppSlice({
  name: "connectivity",
  initialState,
  reducers: (create) => ({
    connect: create.reducer((state) => {
      state.state = "connecting";
    }),

    connected: create.reducer((state, action: PayloadAction<Pick<ConnectivitySliceState, "userId" | "room">>) => {
      state.state = "connected";
      state.userId = action.payload.userId;
      state.room = action.payload.room;
    }),

    disconnect: create.reducer((state) => {
      state.state = "disconnected";
    }),
  }),
});

export const { connect, connected, disconnect } = connectivitySlice.actions;
