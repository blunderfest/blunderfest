import { Game, Move, Variation } from "@/types";
import { createAppSlice } from "../createAppSlice";
import { prepareAction } from "../prepareAction";

const initialState: {
  gamesByCode: Record<string, Game>;
  variationsByGame: Record<string, Variation>;
} = {
  gamesByCode: {},
  variationsByGame: {},
};

export const gameSlice = createAppSlice({
  name: "game",
  initialState,
  
  reducers: (create) => ({
    move: create.preparedReducer(prepareAction<{ gameCode: string; move: Move }>, (state, action) => {
      const game = state.gamesByCode[action.payload.gameCode];

      const currentVariation = action.payload.move.variationPath.reduce(
        (accumulator, currentValue) => accumulator[currentValue].variations,
        game.variations
      );

      const variation: Variation = {
        move: action.payload.move,
        variations: [],
        position: {
          pieces: [],
          activeColor: "black",
          castlingAvailability: [],
          enPassant: undefined,
          halfmoveClock: 0,
          fullmoveNumber: 0,
        },
      };

      currentVariation.push(variation);

      state.variationsByGame[action.payload.gameCode] = variation;
    }),
  }),
});

export const { move } = gameSlice.actions;
