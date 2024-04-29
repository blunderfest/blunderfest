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
    builder.addCase(join.fulfilled, (state, action) => {
      const game = action.payload.games.find((game) => game.gameCode == action.payload.currentGame);
      state.position = game?.startingPosition;
    });
  },
});

export const selectCurrentPosition = (state: RootState) => state.board.position;
