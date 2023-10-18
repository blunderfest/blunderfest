import { sva } from "styled-system/css";

export const squareRecipe = sva({
  slots: ["root", "selection", "piece"],
  base: {
    root: {
      aspectRatio: "square",
      position: "relative",
      cursor: "pointer",
      boxSizing: "border-box",
      _focus: {
        border: "5px solid #000",
        outline: "none",
      },
    },
    selection: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 },
    piece: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 },
  },
  variants: {
    color: {
      dark: {
        root: {
          backgroundColor: "square.dark",
        },
      },
      light: {
        root: {
          backgroundColor: "square.light",
        },
      },
    },
    selected: {
      none: {},
      simple: {
        selection: {
          backgroundColor: "square.selection.simple",
          filter: "opacity(0.8)",
        },
      },
      ctrl: {
        selection: {
          backgroundColor: "square.selection.ctrl",
          filter: "opacity(0.8)",
        },
      },
      alt: {
        selection: {
          backgroundColor: "square.selection.alt",
          filter: "opacity(0.8)",
        },
      },
      highlighted: {},
    },
  },
  compoundVariants: [
    {
      selected: "highlighted",
      color: "light",
      css: {
        selection: {
          backgroundColor: "square.selection.highlight.light",
          filter: "brightness(120%) opacity(0.8)",
        },
      },
    },
    {
      selected: "highlighted",
      color: "dark",
      css: {
        selection: {
          backgroundColor: "square.selection.highlight.dark",
          filter: "brightness(140%) opacity(0.8)",
        },
      },
    },
  ],
});
