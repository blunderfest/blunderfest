import { Position } from "@/types";
import { createAppSlice } from "../createAppSlice";
import { RootState } from "../store";

const initialState: {
  position?: Position;
} = {
  position: {
    activeColor: "white",
    castlingAvailability: ["K", "k", "Q", "q"],
    fullmoveNumber: 1,
    halfmoveClock: 0,
    enPassant: 13,
    pieces: [
      { symbol: "R" },
      { symbol: "N" },
      { symbol: "B" },
      { symbol: "Q" },
      { symbol: "K" },
      { symbol: "B" },
      { symbol: "N" },
      { symbol: "R" },

      { symbol: "P" },
      { symbol: "P" },
      { symbol: "P" },
      { symbol: "P" },
      { symbol: "P" },
      { symbol: "P" },
      { symbol: "P" },
      { symbol: "P" },

      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,

      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,

      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,

      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,

      { symbol: "p" },
      { symbol: "p" },
      { symbol: "p" },
      { symbol: "p" },
      { symbol: "p" },
      { symbol: "p" },
      { symbol: "p" },
      { symbol: "p" },

      { symbol: "r" },
      { symbol: "n" },
      { symbol: "b" },
      { symbol: "k" },
      { symbol: "q" },
      { symbol: "b" },
      { symbol: "n" },
      { symbol: "r" },
    ],
  },
};

export const boardSlice = createAppSlice({
  name: "board",
  initialState,
  reducers: (create) => ({
    flip: create.reducer((state) => {}),
  }),
});

export const selectCurrentPosition = (state: RootState) => state.board.position;
export const { flip } = boardSlice.actions;
