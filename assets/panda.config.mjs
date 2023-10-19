import { defineConfig, defineGlobalStyles } from "@pandacss/dev";

const globalCss = defineGlobalStyles({
  body: {
    backgroundGradient: "background",
    height: "100vh",
  },
});

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx}"],
  exclude: [],
  jsxFramework: "react",
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
            light: {
              value: "{colors.sky.200}",
            },
            dark: {
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
                light: {
                  value: "{colors.square.light}",
                },
                dark: {
                  value: "{colors.square.dark}",
                },
              },
            },
          },
        },
      },
    },
  },
  watch: true,
  optimize: true,

  outdir: "styled-system",
  globalCss,
});
