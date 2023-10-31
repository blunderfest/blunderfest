import { defineRecipe } from "@pandacss/dev";

export const buttonRecipe = defineRecipe({
  className: "button",
  description: "The styles for the Button component v2",
  base: {
    display: "flex",
  },
  variants: {
    variant: {
      funky: { bg: "red.2", color: "white" },
      edgy: { border: "1px solid {colors.red.5}" },
    },
    size: {
      sm: { padding: "4", fontSize: "12px" },
      lg: { padding: "8", fontSize: "40px" },
    },
    shape: {
      square: { borderRadius: "0" },
      circle: { borderRadius: "full" },
    },
  },
  defaultVariants: {
    variant: "funky",
    size: "sm",
    shape: "circle",
  },
});
