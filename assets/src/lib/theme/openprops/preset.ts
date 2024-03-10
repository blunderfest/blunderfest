import { Preset } from "@pandacss/dev";
import { breakpoints } from "./breakpoints";
import { keyframes, semanticAnimations } from "./keyframes";
import { semanticShadows } from "./shadows";
import { tokens } from "./tokens";
import { utilities } from "./utilities";

const definePreset = <T extends Preset>(config: T) => config;

export const preset = definePreset({
    theme: {
        keyframes,
        tokens,
        semanticTokens: {
            animations: semanticAnimations,
            shadows: semanticShadows,
        },

        breakpoints,
    },

    utilities,
});
