import { connected, presenceDiff, presenceState } from "@/store/actions";
import { createSelector, createSlice } from "@reduxjs/toolkit";

/**
 * @type {Room}
 */
const intialState = {
  roomCode: "",
  timestamp: 0,
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
        state.timestamp = action.payload.room.timestamp;
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

const selectUsers =
  /**
   * @param {import("@/store").RootState} state
   */
  (state) => state.room.users;

export const selectActiveUsers = createSelector(selectUsers, (users) => users.map((user) => user.id));
