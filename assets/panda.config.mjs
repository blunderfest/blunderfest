import { defineConfig, defineGlobalStyles } from "@pandacss/dev";

const globalCss = defineGlobalStyles({
  body: {
    backgroundGradient: "background",
    height: "100vh",
    touchAction: "none",
  },
});

export default defineConfig({
  preflight: true,
  presets: ["@pandacss/preset-panda"],
  include: ["./src/**/*.{js,jsx}"],
  exclude: [],
  jsxFramework: "react",
  conditions: {
    extend: {
      close: "[data-close]",
    },
  },
  theme: {
    extend: {
      tokens: {
        gradients: {
          background: {
            value: {
              type: "linear",
              placement: "to bottom right",
              stops: ["{colors.slate.600}", "{colors.slate.800}"],
            },
          },
        },
        colors: {
          primary: {
            value: "{colors.yellow.300}",
          },
          success: {
            value: "{colors.green.700}",
          },
          warning: {
            value: "{colors.amber.500}",
          },
          error: {
            value: "{colors.red.600}",
          },
          square: {
            white: {
              value: "{colors.neutral.200}",
            },
            black: {
              value: "{colors.sky.700}",
            },
            keyboardFocussed: {
              border: {
                value: "{colors.neutral.900}",
              },
            },
            selection: {
              simple: {
                value: "{colors.red.600}",
              },
              ctrl: {
                value: "{colors.green.600}",
              },
              alt: {
                value: "{colors.yellow.400}",
              },
              highlight: {
                white: {
                  value: "{colors.sky.300}",
                },
                black: {
                  value: "{colors.square.black}",
                },
              },
            },
          },
        },
      },
      semanticTokens: {
        colors: {
          primary: {
            DEFAULT: {
              value: {
                base: "{colors.primary}",
              },
            },
          },
        },
      },
    },
  },
  watch: true,
  optimize: true,
  minify: true,

  cwd: "/workspace/blunderfest/assets",
  outdir: "styled-system",
  globalCss,
});
