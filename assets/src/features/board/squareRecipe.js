import { defineSlotRecipe } from "@pandacss/dev";

export const squareRecipe = defineSlotRecipe({
  className: "square",
  slots: ["root", "highlight", "mark", "piece"],
  base: {
    root: {
      aspectRatio: "square",
      position: "relative",
      cursor: "pointer",
      boxSizing: "border-box",
      outline: "none",
    },
    highlight: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 },
    mark: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0, borderRadius: "round" },
    piece: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 },
  },
  variants: {
    focussed: {
      true: {},
    },
    color: {
      dark: {},
      light: {},
    },
    marked: {
      none: {},
      simple: {},
      ctrl: {},
      alt: {},
    },
    highlighted: {
      true: {},
    },
  },
  compoundVariants: [
    {
      focussed: true,
      css: {
        root: {
          border: "square.focussed",
        },
      },
    },
    {
      color: "dark",
      css: {
        root: {
          backgroundColor: "square.dark.background",
        },
      },
    },
    {
      color: "light",
      css: {
        root: {
          backgroundColor: "square.light.background",
        },
      },
    },
    {
      highlighted: true,
      marked: "none",
      color: "dark",
      css: {
        highlight: {
          backgroundColor: "square.dark.background.highlight",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      highlighted: true,
      marked: "none",
      color: "light",
      css: {
        highlight: {
          backgroundColor: "square.light.background.highlight",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      marked: "simple",
      color: "dark",
      css: {
        mark: {
          border: "square.dark.mark.simple",
        },
      },
    },
    {
      marked: "simple",
      color: "light",
      css: {
        mark: {
          border: "square.light.mark.simple",
        },
      },
    },
    {
      marked: "ctrl",
      color: "dark",
      css: {
        mark: {
          border: "square.dark.mark.ctrl",
        },
      },
    },
    {
      marked: "ctrl",
      color: "light",
      css: {
        mark: {
          border: "square.light.mark.ctrl",
        },
      },
    },
    {
      marked: "alt",
      color: "dark",
      css: {
        mark: {
          border: "square.dark.mark.alt",
        },
      },
    },
    {
      marked: "alt",
      color: "light",
      css: {
        mark: {
          border: "square.light.mark.alt",
        },
      },
    },
  ],
});
