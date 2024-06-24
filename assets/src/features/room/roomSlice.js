import { connected, presenceDiff, presenceState } from "@/store/actions";
import { createSelector, createSlice } from "@reduxjs/toolkit";

/**
 * @type {Room}
 */
const intialState = {
  roomCode: "",
  timestamp: 0,
  users: {},
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
        state.users = action.payload;
      })
      .addCase(presenceDiff, (state, action) => {
        const { joins, leaves } = action.payload;

        for (const userId in joins) {
          if (!(userId in state.users)) {
            state.users[userId] = { metas: [] };
          }

          joins[userId].metas.forEach((meta) => state.users[userId].metas.push(meta));
        }

        for (const userId in leaves) {
          if (userId in state.users) {
            const metas = state.users[userId].metas.filter((meta) =>
              leaves[userId].metas.find((leave) => leave.phxRef !== meta.phxRef)
            );

            if (metas.length) {
              state.users[userId].metas = metas;
            } else {
              delete state.users[userId];
            }
          }
        }
      });
  },
});

export const selectActiveUsers = createSelector(
  /**
   * @param {import("@/store").RootState} state
   */
  (state) => state.room.users,
  (users) => Object.keys(users)
);
