import { tv } from "tailwind-variants";

export const squareRecipe = tv({
  base: "relative aspect-square",
  slots: {
    piece: "absolute h-full w-full cursor-pointer",
    selected: "absolute h-full w-full",
    highlighted: "absolute h-full w-full",
  },
  variants: {
    color: {
      dark: {
        base: "bg-neutral-900 dark:bg-neutral-800",
      },
      light: {
        base: "bg-neutral-200 dark:bg-neutral-400",
      },
    },
    selected: {
      true: {
        selected: "border-4 border-blue-800",
      },
    },
    highlighted: {
      true: {},
    },
  },
  compoundVariants: [
    {
      highlighted: true,
      color: "dark",
      className: {
        highlighted: "bg-yellow-400/80 dark:bg-yellow-400/70",
      },
    },
    {
      highlighted: true,
      color: "light",
      className: {
        highlighted: "bg-yellow-400/50 dark:bg-yellow-400/50",
      },
    },
  ],
});
