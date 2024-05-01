import { Position } from "@/types";
import { createAppSlice } from "../createAppSlice";
import { RootState } from "../store";
import { join } from "./socketSlice";

const initialState: {
  position?: Position;
} = {
  position: undefined,
};

export const boardSlice = createAppSlice({
  name: "board",
  initialState,
  reducers: {},
  extraReducers(builder) {
  },
});

export const selectCurrentPosition = (state: RootState) => state.board.position;
