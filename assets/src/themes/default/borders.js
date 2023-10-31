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
});
