import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],
  exclude: [],
  optimize: false,

  presets: ["@pandacss/preset-base", "@park-ui/panda-preset"],
  globalCss: {
    body: {
      backgroundColor: "surface.background.2",
      color: "surface.text.2",
    },
  },
  conditions: {
    extend: {
      dark: '[data-color-scheme="dark"] &',
      light: '[data-color-scheme="light"] &',
    },
  },

  theme: {
    extend: {
      semanticTokens: {
        colors: {
          surface: {
            background: {
              1: {
                value: "neutral.1",
              },
              2: {
                value: "neutral.2",
              },
            },
            text: {
              1: {
                value: "neutral.11",
              },
              2: {
                value: "neutral.12",
              },
            },
          },
          square: {
            dark: {
              value: {
                _light: "{colors.neutral.light.10}",
                _dark: "{colors.gray.dark.7}",
              },
            },
            light: {
              value: {
                _light: "gray.4",
                _dark: "gray.11",
              },
            },
            focussed: {
              value: "blue.8",
            },
            marked: {
              value: "green.8",
            },
          },
        },
      },
    },
  },

  outdir: "styled-system",
  jsxFramework: "react",
});
