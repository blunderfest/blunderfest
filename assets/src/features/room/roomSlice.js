import { connected, joined, left } from "@/store/actions";
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
      .addCase(joined, (state, action) => {
        const { userId, meta } = action.payload;

        if (!state.users[userId]) {
          state.users[userId] = {};
        }

        state.users[userId][meta.phxRef] = meta;
      })
      .addCase(left, (state, action) => {
        const { userId, meta } = action.payload;

        delete state.users[userId][meta.phxRef];

        if (Object.keys(state.users[userId]).length === 0) {
          delete state.users[userId];
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
