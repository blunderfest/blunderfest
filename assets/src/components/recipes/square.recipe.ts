import { sva } from "design-system/css";

export const squareRecipe = sva({
  slots: ["root", "overlay", "piece", "selected"],
  base: {
    root: {
      aspectRatio: "square",
      position: "relative",
    },
    overlay: {
      position: "absolute",
      top: "8px",
      left: "8px",
      bottom: "8px",
      right: "8px",
    },
    selected: {
      position: "absolute",
      top: "0",
      left: "0",
      bottom: "0",
      right: "0",
    },
    piece: {
      position: "absolute",
      top: "1",
      left: "1",
      bottom: "1",
      right: "1",
    },
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
      true: {
        selected: {
          borderWidth: "8px",
          borderStyle: "solid",
          borderColor: {
            _dark: "radix.blue.8.dark",
            _light: "radix.blue.8.light",
          },
        },
      },
    },
    focussed: {
      true: {
        selected: {
          borderWidth: "8px",
          borderStyle: "solid",
          borderColor: {
            _dark: "radix.blue.8.dark",
            _light: "radix.blue.8.light",
          },
        },
      },
    },
    marked: {
      true: {
        overlay: {
          borderWidth: "thick",
          borderStyle: "solid",
          borderColor: {
            _dark: "radix.green.9.dark",
            _light: "radix.green.8.light",
          },
          borderRadius: "full",
        },
      },
    },
    isOver: {
      true: {
        piece: {
          backgroundColor: {
            _dark: "radix.yellow.10.dark",
            _light: "radix.yellow.10.light",
          },
        },
      },
    },
  },
});
