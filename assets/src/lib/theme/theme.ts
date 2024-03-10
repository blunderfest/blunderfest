import { defineTokens } from "@pandacss/dev";
import { colors } from "./colors";

import { preset } from "@pandacss/preset-panda";

const { tokens, ...remaining } = preset.theme;

export const theme = {
    ...remaining,
    tokens: defineTokens(Object.assign({}, { ...tokens }, { colors: colors })),
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
