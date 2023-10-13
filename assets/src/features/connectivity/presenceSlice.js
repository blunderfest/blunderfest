import { createSlice } from "@reduxjs/toolkit";

/**
 * @type {{
 *     users: string[]
 * }}
 */
const initialState = {
  users: [],
};

export const presenceSlice = createSlice({
  name: "system/presence",
  initialState,
  reducers: {
    update: (state, /** @type {PayloadAction<string[]>} */ action) => {
      state.users = action.payload;
    },
  },
});

export const { update } = presenceSlice.actions;

export const presenceReducer = presenceSlice.reducer;
