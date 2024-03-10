import { defineTokens } from "@pandacss/dev";
import { aspectRatios } from "./aspectRatios";
import { borderWidths } from "./borderWidths";
import { colors } from "./colors";
import { fontSizes } from "./fontSizes";
import { radii } from "./radii";
import { sizes } from "./sizes";
import { zIndex } from "./zIndex";

export const theme = {
    tokens: defineTokens({
        colors: colors,
        aspectRatios: aspectRatios,
        sizes: sizes,
        spacing: sizes,
        borderWidths: borderWidths,
        radii: radii,
        fontSizes: fontSizes,
        zIndex: zIndex,
    }),
    semanticTokens: {
        colors: {
            surface: {
                1: {
                    value: {
                        _light: "{colors.slate.light.1}",
                        _dark: "{colors.slate.dark.1}",
                    },
                },
                2: {
                    value: {
                        _light: "{colors.slate.light.2}",
                        _dark: "{colors.slate.dark.2}",
                    },
                },
            },
            square: {
                dark: {
                    value: {
                        _light: "{colors.gray.light.12}",
                        _dark: "{colors.gray.dark.4}",
                    },
                },
                light: {
                    value: {
                        _light: "{colors.gray.light.4}",
                        _dark: "{colors.gray.dark.12}",
                    },
                },
                focussed: {
                    value: {
                        _light: "{colors.blue.light.8}",
                        _dark: "{colors.blue.dark.8}",
                    },
                },
                marked: {
                    value: {
                        _light: "{colors.green.light.8}",
                        _dark: "{colors.green.dark.8}",
                    },
                },
            },
        },
    },
};
