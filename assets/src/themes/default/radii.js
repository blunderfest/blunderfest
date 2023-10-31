import { defineTokens } from "@pandacss/dev";
import OpenProps from "open-props";

export const radii = defineTokens.radii({
  1: { value: OpenProps["--radius-1"] },
  2: { value: OpenProps["--radius-2"] },
  3: { value: OpenProps["--radius-3"] },
  4: { value: OpenProps["--radius-4"] },
  5: { value: OpenProps["--radius-5"] },
  6: { value: OpenProps["--radius-6"] },
  round: { value: OpenProps["--radius-round"] },
});
