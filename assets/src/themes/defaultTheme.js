import { squareRecipe } from "@/features/board/squareRecipe";
import { borders, breakpoints, colors, gradients, radii, semanticTokens } from "./default";

/**
 * @type {import ("@pandacss/types").Theme}
 */
export const defaultTheme = {
  breakpoints: breakpoints,
  tokens: {
    borders: borders,
    gradients: gradients,
    colors: colors,
    radii: radii,
  },
  semanticTokens: semanticTokens,
  recipes: {},
  slotRecipes: {
    square: squareRecipe,
  },
};
