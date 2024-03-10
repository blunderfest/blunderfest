import { defineTokens } from "@pandacss/dev";
import { aspectRatios } from "./aspectRatios";
import { borderWidths } from "./borderWidths";
import { colors } from "./colors";
import { radii } from "./radii";
import { sizes } from "./sizes";

export const theme = {
    tokens: defineTokens({
        colors: colors,
        aspectRatios: aspectRatios,
        sizes: sizes,
        spacing: sizes,
        borderWidths: borderWidths,
        radii: radii,
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
                        _light: "{colors.gray.light.5}",
                        _dark: "{colors.gray.dark.5}",
                    },
                },
                light: {
                    value: {
                        _light: "{colors.gray.light.2}",
                        _dark: "{colors.gray.dark.12}",
                    },
                },
                border: {
                    value: {
                        _light: "{colors.blue.light.8}",
                        _dark: "{colors.blue.dark.8}",
                    },
                },
            },
        },
    },
};
