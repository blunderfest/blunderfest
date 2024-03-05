import { style } from "@vanilla-extract/css";
import AspectRatio from "open-props/src/props.aspects";

export const board = style({
    aspectRatio: AspectRatio["--ratio-square"],
    height: "100vh",
    display: "inline-grid",
    gridTemplateColumns: "repeat(8, 1fr)",
    gridTemplateRows: "repeat(8, 1fr)",
});
