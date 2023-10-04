import { style } from "@vanilla-extract/css";
import sizes from "open-props/src/props.sizes.js";
import colors from "open-props/src/props.colors-hsl.js";

export const testStyle = style({
	backgroundColor: colors["--indigo-5-hsl"],
	fontSize: sizes["--size-3"],
});
