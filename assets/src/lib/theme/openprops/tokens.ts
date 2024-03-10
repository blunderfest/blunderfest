import type { Tokens } from "@pandacss/types";
import { aspectRatios } from "./aspectRatios";
import { assets } from "./assets";
import { borderWidths, radii } from "./borders";
import { gradients } from "./gradients";
import { animations, easings } from "./keyframes";
import { shadows } from "./shadows";
import { sizes, spacing } from "./sizes";
import { fontSizes, fontWeights, fonts, letterSpacings, lineHeights } from "./typography";
import { zIndex } from "./zIndex";

const defineTokens = <T extends Tokens>(v: T) => v;

export const tokens = defineTokens({
    aspectRatios,
    borderWidths,
    radii,
    easings,
    zIndex,
    letterSpacings,
    fonts,
    lineHeights,
    fontWeights,
    fontSizes,
    shadows,
    assets,
    gradients,
    spacing,
    sizes,
    animations,
});
