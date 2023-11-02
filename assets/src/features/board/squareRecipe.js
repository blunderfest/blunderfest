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
    draggedOver: {
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
      draggedOver: false,
      color: "dark",
      css: {
        highlight: {
          backgroundColor: "square.dark.background.highlighted",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      highlighted: true,
      draggedOver: false,
      color: "light",
      css: {
        highlight: {
          backgroundColor: "square.light.background.highlighted",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      draggedOver: true,
      color: "light",
      css: {
        highlight: {
          backgroundColor: "square.light.background.draggedOver",
          filter: "opacity(0.6)",
        },
      },
    },
    {
      draggedOver: true,
      color: "dark",
      css: {
        highlight: {
          backgroundColor: "square.dark.background.draggedOver",
          filter: "opacity(0.8)",
        },
      },
    },
    {
      marked: "simple",
      color: "dark",
      css: {
        mark: {
          border: "square.dark.marked.simple",
        },
      },
    },
    {
      marked: "simple",
      color: "light",
      css: {
        mark: {
          border: "square.light.marked.simple",
        },
      },
    },
    {
      marked: "ctrl",
      color: "dark",
      css: {
        mark: {
          border: "square.dark.marked.ctrl",
        },
      },
    },
    {
      marked: "ctrl",
      color: "light",
      css: {
        mark: {
          border: "square.light.marked.ctrl",
        },
      },
    },
    {
      marked: "alt",
      color: "dark",
      css: {
        mark: {
          border: "square.dark.marked.alt",
        },
      },
    },
    {
      marked: "alt",
      color: "light",
      css: {
        mark: {
          border: "square.light.marked.alt",
        },
      },
    },
  ],
});
