import { defineTokens } from "@pandacss/dev";
import OpenProps from "open-props/src/props.zindex.js";

export const zIndex = defineTokens.zIndex({
  1: {
    value: OpenProps["--layer-1"],
  },
  2: {
    value: OpenProps["--layer-2"],
  },
  3: {
    value: OpenProps["--layer-3"],
  },
  4: {
    value: OpenProps["--layer-4"],
  },
  5: {
    value: OpenProps["--layer-5"],
  },
  important: {
    value: OpenProps["--layer-important"],
  },
});
