import { defineSlotRecipe } from "@pandacss/dev";

export const squareRecipe = defineSlotRecipe({
  className: "square",
  slots: ["root", "selection", "piece"],
  base: {
    root: {
      aspectRatio: "square",
      position: "relative",
      cursor: "pointer",
      boxSizing: "border-box",
      outline: "none",
    },
    selection: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 },
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
          border: "5px solid red",
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
        selection: {
          backgroundColor: "square.dark.background.highlighted",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      highlighted: true,
      marked: "none",
      color: "light",
      css: {
        selection: {
          backgroundColor: "square.light.background.highlighted",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      marked: "simple",
      color: "dark",
      css: {
        selection: {
          backgroundColor: "square.dark.background.selection.simple",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      marked: "simple",
      color: "light",
      css: {
        selection: {
          backgroundColor: "square.light.background.selection.simple",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      marked: "ctrl",
      color: "dark",
      css: {
        selection: {
          backgroundColor: "square.dark.background.selection.ctrl",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      marked: "ctrl",
      color: "light",
      css: {
        selection: {
          backgroundColor: "square.light.background.selection.ctrl",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      marked: "alt",
      color: "dark",
      css: {
        selection: {
          backgroundColor: "square.dark.background.selection.alt",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      marked: "alt",
      color: "light",
      css: {
        selection: {
          backgroundColor: "square.light.background.selection.alt",
          filter: "opacity(0.8)",
        },
      },
    },
  ],
});
