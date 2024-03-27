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

type JoinedResponse = {
  roomCode: string;
  games: string[];
  gamesByCode: Record<
    string,
    {
      position: string;
      gameCode: string;
      squares: Array<{
        color: "dark" | "light";
        squareIndex: number;
        piece: "k" | "K" | "q" | "Q" | "r" | "R" | "b" | "B" | "n" | "N" | "p" | "P" | null;
      }>;
    }
  >;
  activeGame: string;
};

export const connectivitySlice = createSlice({
  name: "connectivity",
  initialState,
  reducers: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    connect: (state, _action: PayloadAction<{ roomCode: string; userToken: string }>) => {
      state.status = "connecting";
    },
    connected: (state) => {
      state.status = "online";
    },
    disconnect: (state) => {
      state.status = "offline";
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    joined: (_state, _action: PayloadAction<JoinedResponse>) => {},
    left: (state) => {
      state.roomCode = "";
    },
  },
});

export const connectivityReducer = connectivitySlice.reducer;
export const { connect, connected, joined, left } = connectivitySlice.actions;
