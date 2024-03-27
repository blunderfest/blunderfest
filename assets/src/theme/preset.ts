import { definePreset } from "@pandacss/dev";
import { breakpoints } from "./breakpoints";
import { containerSizes } from "./containers";
import { keyframes } from "./keyframes";
import { tokens } from "./tokens";
import { textStyles } from "./typography";

export const preset = definePreset({
  globalCss: {
    body: {
      backgroundColor: "surface.background.1",
      color: "surface.text.1",
    },
  },
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
                _light: "{colors.radix.slate.1.light}",
                _dark: "{colors.radix.slate.1.dark}",
              },
            },
            2: {
              value: {
                _light: "{colors.radix.slate.2.light}",
                _dark: "{colors.radix.slate.2.dark}",
              },
            },
          },
          text: {
            1: {
              value: {
                _light: "{colors.radix.slate.11.light}",
                _dark: "{colors.radix.slate.11.dark}",
              },
            },
            2: {
              value: {
                _light: "{colors.radix.slate.12.light}",
                _dark: "{colors.radix.slate.12.dark}",
              },
            },
          },
        },
        square: {
          dark: {
            value: {
              _light: "{colors.radix.gray.10.light}",
              _dark: "{colors.radix.gray.7.dark}",
            },
          },
          light: {
            value: {
              _light: "{colors.radix.gray.4.light}",
              _dark: "{colors.radix.gray.11.dark}",
            },
          },
          focussed: {
            value: {
              _light: "{colors.radix.blue.8.light}",
              _dark: "{colors.radix.blue.8.dark}",
            },
          },
          marked: {
            value: {
              _light: "{colors.radix.green.8.light}",
              _dark: "{colors.radix.green.8.dark}",
            },
          },
        },
      },
    },
  },
});
