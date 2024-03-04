import { style } from "@vanilla-extract/css";
import { reset } from "./layers.css";

export const noMargin = style({
  "@layer": {
    [reset]: {
      margin: 0,
    },
  },
});
