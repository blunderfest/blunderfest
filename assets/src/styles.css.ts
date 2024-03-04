import { style } from "@vanilla-extract/css";
import ColorsHsl from "open-props/src/colors-hsl";

export const container = style({
  padding: 10,
  backgroundColor: `hsl(${ColorsHsl["--choco-10-hsl"]})`,
});
