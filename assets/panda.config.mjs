import { defineConfig, defineGlobalStyles } from "@pandacss/dev";
import pandaBase from "@pandacss/preset-base";
import pandaPreset from "@pandacss/preset-panda";

const globalCss = defineGlobalStyles({
  body: {
    backgroundGradient: "background",
    height: "100vh",
    touchAction: "none",
  },
});

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx}"],
  exclude: [],
  presets: [pandaBase, pandaPreset],
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
            white: {
              value: "{colors.sky.200}",
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
                  value: "{colors.square.white}",
                },
                black: {
                  value: "{colors.square.black}",
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
  minify: true,

  cwd: "/workspace/blunderfest/assets",
  outdir: "styled-system",
  globalCss,
});
