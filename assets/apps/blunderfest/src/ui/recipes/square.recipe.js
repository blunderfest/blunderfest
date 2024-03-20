import { sva } from "@blunderfest/design-system/styled-system/css";

export const square = sva({
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
            _dark: "blue.dark.8",
            _light: "blue.light.8",
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
            _dark: "blue.dark.8",
            _light: "blue.light.8",
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
            _dark: "green.dark.9",
            _light: "green.light.8  ",
          },
          borderRadius: "full",
        },
      },
    },
  },
});
