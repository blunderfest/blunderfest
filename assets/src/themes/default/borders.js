import { defineTokens } from "@pandacss/dev";
import OpenProps from "open-props";

export const borders = defineTokens.borders({
  1: {
    value: OpenProps["--border-size-1"],
  },
  2: {
    value: OpenProps["--border-size-2"],
  },
  3: {
    value: OpenProps["--border-size-3"],
  },
  4: {
    value: OpenProps["--border-size-4"],
  },
  5: {
    value: OpenProps["--border-size-5"],
  },
  square: {
    focussed: {
      value: "{borders.3} solid {colors.gray.10}",
    },
    light: {
      mark: {
        simple: {
          value: "{borders.3} solid {colors.red.10}",
        },
        ctrl: {
          value: "{borders.3} solid {colors.green.11}",
        },
        alt: {
          value: "{borders.3} solid {colors.yellow.5}",
        },
      },
    },
    dark: {
      mark: {
        simple: {
          value: "{borders.3} solid {colors.red.10}",
        },
        ctrl: {
          value: "{borders.3} solid {colors.green.11}",
        },
        alt: {
          value: "{borders.3} solid {colors.yellow.5}",
        },
      },
    },
  },
});
