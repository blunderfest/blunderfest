import { RootState } from "@/store";
import { connected, presenceDiff, presenceState } from "@/store/actions";
import { Room } from "@/types";
import { createSelector, createSlice } from "@reduxjs/toolkit";

const intialState: Room = {
  roomCode: "",
  users: [],
};

export const roomSlice = createSlice({
  name: "room",
  initialState: intialState,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(connected, (state, action) => {
        state.roomCode = action.payload.room.roomCode;
      })
      .addCase(presenceState, (state, action) => {
        state.users = Object.keys(action.payload).map((userId) => ({
          id: userId,
          metas: action.payload[userId].metas,
        }));
      })
      .addCase(presenceDiff, (state, action) => {
        const { joins, leaves } = action.payload;

        for (const userId in joins) {
          const user = state.users.find((user) => user.id === userId);

          if (user) {
            joins[userId].metas.forEach((meta) => {
              user.metas.push(meta);
            });
          } else {
            state.users.push({
              id: userId,
              metas: joins[userId].metas,
            });
          }
        }

        for (const userId in leaves) {
          const user = state.users.find((user) => user.id === userId);

          if (user) {
            const metas = user.metas.filter((meta) => leaves[userId].metas.find((leave) => leave.phxRef !== meta.phxRef));
            user.metas = metas;
          }
        }

        state.users = state.users.filter((user) => user.metas.length > 0);
      });
  },
});

export const selectActiveUsers = createSelector(
  (state: RootState) => state.room.users,
  (users) => users.map((user) => user.id)
);
