import { tv } from "tailwind-variants";

export const pieceRecipe = tv({
  base: "relative z-0 cursor-grab touch-none outline-none hover:scale-110",
  variants: {
    dragging: {
      true: "z-50",
    },
  },
});
