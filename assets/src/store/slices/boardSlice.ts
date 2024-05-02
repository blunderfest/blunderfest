import { Position } from "@/types";
import { createAppSlice } from "../createAppSlice";
import { RootState } from "../store";

const initialState: {
  position?: Position;
} = {
  position: undefined,
};

export const boardSlice = createAppSlice({
  name: "board",
  initialState,
  reducers: {},
});

export const selectCurrentPosition = (state: RootState) => state.board.position;
