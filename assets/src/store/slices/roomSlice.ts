import { createAppSlice } from "@/store/createAppSlice";
import { prepareAction } from "../prepareAction";
import { RootState } from "../store";
import { join } from "./socketSlice";

const initialState: {
  currentGame: string;
  games: string[];
  roomCode: string;
} = {
  currentGame: "",
  games: [],
  roomCode: "",
};

export const roomSlice = createAppSlice({
  name: "room",
  initialState,
  reducers: (create) => ({
    switchGame: create.preparedReducer(prepareAction<{ gameCode: string }>, (state, action) => {
      state.currentGame = action.payload.gameCode;
    }),
  }),
  extraReducers(builder) {
    builder.addCase(join.fulfilled, (state, action) => {
      state.currentGame = action.payload.currentGame;
      state.games = action.payload.games.map((game) => game.gameCode);
      state.roomCode = action.payload.roomCode;
    });
  },
});

export const { switchGame } = roomSlice.actions;
export const selectCurrentGame = (state: RootState) => state.room.currentGame;
