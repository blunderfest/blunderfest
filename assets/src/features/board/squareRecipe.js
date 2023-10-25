import { sva } from "styled-system/css";

export const squareRecipe = sva({
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
      true: {
        root: {
          borderWidth: "5px",
          borderStyle: "solid",
          borderColor: "square.keyboardFocussed.border",
        },
      },
    },
    color: {
      black: {
        root: {
          backgroundColor: "square.black",
        },
      },
      white: {
        root: {
          backgroundColor: "square.white",
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
      color: "white",
      css: {
        selection: {
          backgroundColor: "square.selection.highlight.white",
          filter: "brightness(120%) opacity(0.8)",
        },
      },
    },
    {
      selected: "highlighted",
      color: "black",
      css: {
        selection: {
          backgroundColor: "square.selection.highlight.black",
          filter: "brightness(140%) opacity(0.8)",
        },
      },
    },
  ],
});
