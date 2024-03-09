import { defineTokens } from "@pandacss/dev";
import { colors } from "./colors";

export const theme = {
    tokens: defineTokens({
        colors: colors,
    }),
    semanticTokens: {
        colors: {
            surface: {
                1: {
                    value: {
                        _osLight: "{colors.slate.light.1}",
                        _osDark: "{colors.slate.dark.1}",
                    },
                },
                2: {
                    value: {
                        _osLight: "{colors.slate.light.2}",
                        _osDark: "{colors.slate.dark.2}",
                    },
                },
            },
            square: {
                dark: {
                    value: {
                        _osLight: "{colors.gray.light.5}",
                        _osDark: "{colors.gray.dark.5}",
                    },
                },
                light: {
                    value: {
                        _osLight: "{colors.gray.light.2}",
                        _osDark: "{colors.gray.dark.12}",
                    },
                },
            },
        },
    },
};
