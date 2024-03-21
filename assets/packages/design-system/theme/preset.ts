import { definePreset } from "@pandacss/dev";
import { breakpoints } from "./breakpoints";
import { containerSizes } from "./containers";
import { keyframes } from "./keyframes";
import { reset } from "./reset";
import { tokens } from "./tokens";
import { textStyles } from "./typography";

export const preset = definePreset({
  globalCss: reset,
  conditions: {
    extend: {
      dark: '[data-color-scheme="dark"] &',
      light: '[data-color-scheme="light"] &',
    },
  },
  theme: {
    keyframes,
    breakpoints,
    tokens,
    textStyles,
    containerSizes,
    semanticTokens: {
      colors: {
        surface: {
          background: {
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
          text: {
            1: {
              value: {
                _light: "{colors.slate.light.11}",
                _dark: "{colors.slate.dark.11}",
              },
            },
            2: {
              value: {
                _light: "{colors.slate.light.12}",
                _dark: "{colors.slate.dark.12}",
              },
            },
          },
        },
        square: {
          dark: {
            value: {
              _light: "{colors.gray.light.10}",
              _dark: "{colors.gray.dark.7}",
            },
          },
          light: {
            value: {
              _light: "{colors.gray.light.4}",
              _dark: "{colors.gray.dark.11}",
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
  },
});