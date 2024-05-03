import { createAppSlice } from "@/store/createAppSlice";
import { prepareAction } from "../prepareAction";
import { RootState } from "../store";
import { createAsyncThunk } from "@reduxjs/toolkit";
import camelcaseKeys from "camelcase-keys";
import { userSocket } from "@/features/connectivity/socket";

const initialState: {
  currentGame: string;
  games: string[];
  roomCode: string;
  userId: string;
  users: Record<
    string,
    {
      metas: {
        phxRef: string;
        onlineAt: number;
      }[];
    }
  >;
} = {
  currentGame: "",
  games: [],
  roomCode: "",
  userId: "",
  users: {},
};

type PresenceState = (typeof initialState)["users"];
type PresenceDiff = {
  leaves: PresenceState;
  joins: PresenceState;
};

export const join = createAsyncThunk("room/join", async (roomCode: string, { dispatch }) => {
  const onMessage = (type: string, payload: Record<string, unknown>) => {
    if (!type.includes("/")) {
      return;
    }

    const action = { type, ...payload };

    dispatch(
      camelcaseKeys(action, {
        deep: true,
      })
    );
  };

  await userSocket.joinAsync(`room:${roomCode}`, onMessage);
});

export const roomSlice = createAppSlice({
  name: "room",
  initialState,

  reducers: (create) => ({
    switchGame: create.preparedReducer(prepareAction<{ gameCode: string }>, (state, action) => {
      state.currentGame = action.payload.gameCode;
    }),

    presenceState: create.reducer<PresenceState>((state, action) => {
      Object.entries(action.payload).forEach(([userId, metas]) => {
        state.users[userId.toUpperCase()] = metas;
      });
    }),

    presenceDiff: create.reducer<PresenceDiff>((state, action) => {
      Object.keys(action.payload.leaves).forEach((userId) => {
        const uppercasedUserId = userId.toUpperCase();
        const leaves = action.payload.leaves[userId].metas.map((meta) => meta.phxRef);
        const user = state.users[uppercasedUserId];

        user.metas = user.metas.filter((meta) => !leaves.includes(meta.phxRef));

        if (user.metas.length === 0) {
          delete state.users[uppercasedUserId];
        }
      });

      Object.keys(action.payload.joins).forEach((userId) => {
        const uppercasedUserId = userId.toUpperCase();
        const joins = action.payload.joins[userId].metas;

        if (!state.users[uppercasedUserId]) {
          state.users[uppercasedUserId] = {
            metas: [],
          };
        }

        const user = state.users[uppercasedUserId];

        joins.forEach((join) => user.metas.push(join));
      });
    }),
  }),

  extraReducers(builder) {
    builder.addCase(join.fulfilled, (state) => {
      state.roomCode = window.config.roomCode;
      state.userId = window.config.userId;
    });
  },
});

export const { switchGame } = roomSlice.actions;
export const selectCurrentGame = (state: RootState) => state.room.currentGame;
