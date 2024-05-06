import { createAppSlice } from "@/store/createAppSlice";
import { prepareAction } from "../prepareAction";
import { RootState } from "../store";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { userSocket } from "@/features/connectivity/socket";

const initialState: {
  currentGame: string;
  games: string[];
  roomCode: string;
  userId: string;
  users: Record<
    string,
    {
      phxRef: string;
      onlineAt: number;
    }[]
  >;
} = {
  currentGame: "",
  games: [],
  roomCode: "",
  userId: "",
  users: {},
};


export const join = createAsyncThunk("room/join", async (roomCode: string, thunkAPI) => {
  await userSocket.joinAsync(`room:${roomCode}`, thunkAPI.dispatch);
});

export const roomSlice = createAppSlice({
  name: "room",
  initialState,

  reducers: (create) => ({
    switchGame: create.preparedReducer(prepareAction<{ gameCode: string }>, (state, action) => {
      state.currentGame = action.payload.gameCode;
    }),

    joins: create.reducer<{
      userId: string;
      phxRef: string;
      onlineAt: number;
    }>((state, action) => {
      if (!(action.payload.userId in state.users)) {
        state.users[action.payload.userId] = [];
      }

      const user = state.users[action.payload.userId];

      if (user.find((meta) => meta.phxRef === action.payload.phxRef)) {
        return;
      }

      user.push({
        phxRef: action.payload.phxRef,
        onlineAt: action.payload.onlineAt,
      });
    }),

    leaves: create.reducer<{
      userId: string;
      phxRef: string;
      onlineAt: number;
    }>((state, action) => {
      if (!(action.payload.userId in state.users)) {
        return;
      }

      const user = state.users[action.payload.userId];
      const index = user.findIndex((meta) => meta.phxRef === action.payload.phxRef);
      if (index === -1) {
        return;
      }

      user.splice(index, 1);
      if (user.length === 0) {
        delete state.users[action.payload.userId];
      }
    }),
  }),

  extraReducers(builder) {
    builder.addCase(join.fulfilled, (state) => {
      state.roomCode = window.config.roomCode;
      state.userId = window.config.userId;
    });
  },
});

export const { switchGame, joins, leaves } = roomSlice.actions;
export const selectCurrentGame = (state: RootState) => state.room.currentGame;
