import { buttonRecipe } from "@/components/buttonRecipe";
import { squareRecipe } from "@/features/board/squareRecipe";
import { defineConfig, defineGlobalStyles, defineSemanticTokens } from "@pandacss/dev";
import OpenProps from "open-props";

/**
 * @param {string} value
 * @param {number?} [alpha]
 */
function hsl(value, alpha) {
  return `hsl(${value} / ${alpha ?? "1"})`;
}

const globalCss = defineGlobalStyles({
  body: {
    backgroundGradient: "background",
    height: "100vh",
    touchAction: "none",
  },
});

export default defineConfig({
  conditions: {
    extend: {
      close: "[data-close]",
    },
  },

  theme: {
    extend: {
      recipes: {
        button: buttonRecipe,
      },
      slotRecipes: {
        square: squareRecipe,
      },
      breakpoints: {
        xxs: OpenProps["--size-xxs"],
        xs: OpenProps["--size-xs"],
        sm: OpenProps["--size-sm"],
        md: OpenProps["--size-md"],
        lg: OpenProps["--size-lg"],
        xl: OpenProps["--size-xl"],
        xxl: OpenProps["--size-xxl"],
      },
      tokens: {
        borders: {
          1: {
            value: OpenProps["--border-size-1"],
          },
          2: {
            value: OpenProps["--border-size-2"],
          },
          3: {
            value: OpenProps["--border-size-3"],
          },
          4: {
            value: OpenProps["--border-size-4"],
          },
          5: {
            value: OpenProps["--border-size-5"],
          },
        },
        gradients: {
          background: {
            value: {
              type: "linear",
              placement: "to bottom right",
              stops: ["{colors.surface.1}", "{colors.surface.4}"],
            },
          },
        },
        colors: {
          choco: {
            0: { value: hsl(OpenProps["--choco-0-hsl"]) },
            1: { value: hsl(OpenProps["--choco-1-hsl"]) },
            2: { value: hsl(OpenProps["--choco-2-hsl"]) },
            3: { value: hsl(OpenProps["--choco-3-hsl"]) },
            4: { value: hsl(OpenProps["--choco-4-hsl"]) },
            5: { value: hsl(OpenProps["--choco-5-hsl"]) },
            6: { value: hsl(OpenProps["--choco-6-hsl"]) },
            7: { value: hsl(OpenProps["--choco-7-hsl"]) },
            8: { value: hsl(OpenProps["--choco-8-hsl"]) },
            9: { value: hsl(OpenProps["--choco-9-hsl"]) },
            10: { value: hsl(OpenProps["--choco-10-hsl"]) },
            11: { value: hsl(OpenProps["--choco-11-hsl"]) },
            12: { value: hsl(OpenProps["--choco-12-hsl"]) },
          },
          gray: {
            0: { value: hsl(OpenProps["--gray-0-hsl"]) },
            1: { value: hsl(OpenProps["--gray-1-hsl"]) },
            2: { value: hsl(OpenProps["--gray-2-hsl"]) },
            3: { value: hsl(OpenProps["--gray-3-hsl"]) },
            4: { value: hsl(OpenProps["--gray-4-hsl"]) },
            5: { value: hsl(OpenProps["--gray-5-hsl"]) },
            6: { value: hsl(OpenProps["--gray-6-hsl"]) },
            7: { value: hsl(OpenProps["--gray-7-hsl"]) },
            8: { value: hsl(OpenProps["--gray-8-hsl"]) },
            9: { value: hsl(OpenProps["--gray-9-hsl"]) },
            10: { value: hsl(OpenProps["--gray-10-hsl"]) },
            11: { value: hsl(OpenProps["--gray-11-hsl"]) },
            12: { value: hsl(OpenProps["--gray-12-hsl"]) },
          },
          green: {
            0: { value: hsl(OpenProps["--green-0-hsl"]) },
            1: { value: hsl(OpenProps["--green-1-hsl"]) },
            2: { value: hsl(OpenProps["--green-2-hsl"]) },
            3: { value: hsl(OpenProps["--green-3-hsl"]) },
            4: { value: hsl(OpenProps["--green-4-hsl"]) },
            5: { value: hsl(OpenProps["--green-5-hsl"]) },
            6: { value: hsl(OpenProps["--green-6-hsl"]) },
            7: { value: hsl(OpenProps["--green-7-hsl"]) },
            8: { value: hsl(OpenProps["--green-8-hsl"]) },
            9: { value: hsl(OpenProps["--green-9-hsl"]) },
            10: { value: hsl(OpenProps["--green-10-hsl"]) },
            11: { value: hsl(OpenProps["--green-11-hsl"]) },
            12: { value: hsl(OpenProps["--green-12-hsl"]) },
          },
          indigo: {
            0: { value: hsl(OpenProps["--indigo-0-hsl"]) },
            1: { value: hsl(OpenProps["--indigo-1-hsl"]) },
            2: { value: hsl(OpenProps["--indigo-2-hsl"]) },
            3: { value: hsl(OpenProps["--indigo-3-hsl"]) },
            4: { value: hsl(OpenProps["--indigo-4-hsl"]) },
            5: { value: hsl(OpenProps["--indigo-5-hsl"]) },
            6: { value: hsl(OpenProps["--indigo-6-hsl"]) },
            7: { value: hsl(OpenProps["--indigo-7-hsl"]) },
            8: { value: hsl(OpenProps["--indigo-8-hsl"]) },
            9: { value: hsl(OpenProps["--indigo-9-hsl"]) },
            10: { value: hsl(OpenProps["--indigo-10-hsl"]) },
            11: { value: hsl(OpenProps["--indigo-11-hsl"]) },
            12: { value: hsl(OpenProps["--indigo-12-hsl"]) },
          },
          orange: {
            0: { value: hsl(OpenProps["--orange-0-hsl"]) },
            1: { value: hsl(OpenProps["--orange-1-hsl"]) },
            2: { value: hsl(OpenProps["--orange-2-hsl"]) },
            3: { value: hsl(OpenProps["--orange-3-hsl"]) },
            4: { value: hsl(OpenProps["--orange-4-hsl"]) },
            5: { value: hsl(OpenProps["--orange-5-hsl"]) },
            6: { value: hsl(OpenProps["--orange-6-hsl"]) },
            7: { value: hsl(OpenProps["--orange-7-hsl"]) },
            8: { value: hsl(OpenProps["--orange-8-hsl"]) },
            9: { value: hsl(OpenProps["--orange-9-hsl"]) },
            10: { value: hsl(OpenProps["--orange-10-hsl"]) },
            11: { value: hsl(OpenProps["--orange-11-hsl"]) },
            12: { value: hsl(OpenProps["--orange-12-hsl"]) },
          },
          red: {
            0: { value: hsl(OpenProps["--red-0-hsl"]) },
            1: { value: hsl(OpenProps["--red-1-hsl"]) },
            2: { value: hsl(OpenProps["--red-2-hsl"]) },
            3: { value: hsl(OpenProps["--red-3-hsl"]) },
            4: { value: hsl(OpenProps["--red-4-hsl"]) },
            5: { value: hsl(OpenProps["--red-5-hsl"]) },
            6: { value: hsl(OpenProps["--red-6-hsl"]) },
            7: { value: hsl(OpenProps["--red-7-hsl"]) },
            8: { value: hsl(OpenProps["--red-8-hsl"]) },
            9: { value: hsl(OpenProps["--red-9-hsl"]) },
            10: { value: hsl(OpenProps["--red-10-hsl"]) },
            11: { value: hsl(OpenProps["--red-11-hsl"]) },
            12: { value: hsl(OpenProps["--red-12-hsl"]) },
          },
          stone: {
            0: { value: hsl(OpenProps["--stone-0-hsl"]) },
            1: { value: hsl(OpenProps["--stone-1-hsl"]) },
            2: { value: hsl(OpenProps["--stone-2-hsl"]) },
            3: { value: hsl(OpenProps["--stone-3-hsl"]) },
            4: { value: hsl(OpenProps["--stone-4-hsl"]) },
            5: { value: hsl(OpenProps["--stone-5-hsl"]) },
            6: { value: hsl(OpenProps["--stone-6-hsl"]) },
            7: { value: hsl(OpenProps["--stone-7-hsl"]) },
            8: { value: hsl(OpenProps["--stone-8-hsl"]) },
            9: { value: hsl(OpenProps["--stone-9-hsl"]) },
            10: { value: hsl(OpenProps["--stone-10-hsl"]) },
            11: { value: hsl(OpenProps["--stone-11-hsl"]) },
            12: { value: hsl(OpenProps["--stone-12-hsl"]) },
          },
          yellow: {
            0: { value: hsl(OpenProps["--yellow-0-hsl"]) },
            1: { value: hsl(OpenProps["--yellow-1-hsl"]) },
            2: { value: hsl(OpenProps["--yellow-2-hsl"]) },
            3: { value: hsl(OpenProps["--yellow-3-hsl"]) },
            4: { value: hsl(OpenProps["--yellow-4-hsl"]) },
            5: { value: hsl(OpenProps["--yellow-5-hsl"]) },
            6: { value: hsl(OpenProps["--yellow-6-hsl"]) },
            7: { value: hsl(OpenProps["--yellow-7-hsl"]) },
            8: { value: hsl(OpenProps["--yellow-8-hsl"]) },
            9: { value: hsl(OpenProps["--yellow-9-hsl"]) },
            10: { value: hsl(OpenProps["--yellow-10-hsl"]) },
            11: { value: hsl(OpenProps["--yellow-11-hsl"]) },
            12: { value: hsl(OpenProps["--yellow-12-hsl"]) },
          },
        },
      },

      semanticTokens: defineSemanticTokens({
        colors: {
          primary: {
            value: {
              _osLight: "{colors.yellow.4}",
              _osDark: "{colors.yellow.4}",
            },
          },
          secondary: {
            value: {
              _osLight: "{colors.indigo.9}",
              _osDark: "{colors.indigo.9}",
            },
          },
          success: {
            value: {
              _osLight: "{colors.green.7}",
              _osDark: "{colors.green.8}",
            },
          },
          warning: {
            value: {
              _osLight: "{colors.orange.7}",
              _osDark: "{colors.orange.8}",
            },
          },
          error: {
            value: {
              _osLight: "{colors.red.8}",
              _osDark: "{colors.red.10}",
            },
          },
          surface: {
            1: {
              value: {
                _osLight: "{colors.gray.0}",
                _osDark: "{colors.gray.12}",
              },
            },
            2: {
              value: {
                _osLight: "{colors.gray.1}",
                _osDark: "{colors.gray.11}",
              },
            },
            3: {
              value: {
                _osLight: "{colors.gray.2}",
                _osDark: "{colors.gray.10}",
              },
            },
            4: {
              value: {
                _osLight: "{colors.gray.3}",
                _osDark: "{colors.gray.9}",
              },
            },
          },
          square: {
            dark: {
              background: {
                DEFAULT: {
                  value: "{colors.indigo.10}",
                },
                highlighted: {
                  value: "{colors.indigo.1}",
                },
                selection: {
                  simple: {
                    value: "{colors.red.10}",
                  },
                  ctrl: {
                    value: "{colors.green.10}",
                  },
                  alt: {
                    value: "{colors.yellow.10}",
                  },
                },
              },
            },
            light: {
              background: {
                DEFAULT: {
                  value: "{colors.stone.2}",
                },
                highlighted: {
                  value: "{colors.stone.10}",
                },
                selection: {
                  simple: {
                    value: "{colors.red.4}",
                  },
                  ctrl: {
                    value: "{colors.green.4}",
                  },
                  alt: {
                    value: "{colors.yellow.4}",
                  },
                },
              },
            },
          },
        },
      }),
    },
  },

  preflight: true,
  eject: true,
  presets: ["@pandacss/preset-base"],
  include: ["./src/**/*.{js,jsx}"],
  exclude: [],
  jsxFramework: "react",
  hash: false,
  minify: false,
  optimize: false,
  watch: true,

  outdir: "styled-system",
  globalCss,
});
