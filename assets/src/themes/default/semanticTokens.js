import { defineSemanticTokens } from "@pandacss/dev";

export const semanticTokens = defineSemanticTokens({
  borders: {
    square: {
      focussed: {
        value: {
          color: "hsl({colors.gray.10} / 1)",
          width: "borders.3",
          style: "solid",
        },
      },
      light: {
        mark: {
          simple: {
            value: "{borders.3} solid hsl({colors.red.8} / 1)",
          },
          ctrl: {
            value: "{borders.3} solid hsl({colors.green.9} / 1)",
          },
          alt: {
            value: "{borders.3} solid hsl({colors.yellow.5} / 1)",
          },
        },
      },
      dark: {
        mark: {
          simple: {
            value: "{borders.3} solid hsl({colors.red.8} / 1)",
          },
          ctrl: {
            value: "{borders.3} solid hsl({colors.green.7} / 1)",
          },
          alt: {
            value: "{borders.3} solid hsl({colors.yellow.5} / 1)",
          },
        },
      },
    },
  },
  colors: {
    primary: {
      value: {
        _osLight: "hsl({colors.yellow.4} / 1)",
        _osDark: "hsl({colors.yellow.4} / 1)",
      },
    },
    secondary: {
      value: {
        _osLight: "hsl({colors.indigo.9} / 1)",
        _osDark: "hsl({colors.indigo.9} / 1)",
      },
    },
    success: {
      value: {
        _osLight: "hsl({colors.green.7} / 1)",
        _osDark: "hsl({colors.green.8} / 1)",
      },
    },
    warning: {
      value: {
        _osLight: "hsl({colors.orange.7} / 1)",
        _osDark: "hsl({colors.orange.8} / 1)",
      },
    },
    error: {
      value: {
        _osLight: "hsl({colors.red.8} / 1)",
        _osDark: "hsl({colors.red.10} / 1)",
      },
    },
    surface: {
      1: {
        value: {
          _osLight: "hsl({colors.gray.0} / 1)",
          _osDark: "hsl({colors.gray.12} / 1)",
        },
      },
      2: {
        value: {
          _osLight: "hsl({colors.gray.1} / 1)",
          _osDark: "hsl({colors.gray.11} / 1)",
        },
      },
      3: {
        value: {
          _osLight: "hsl({colors.gray.2} / 1)",
          _osDark: "hsl({colors.gray.10} / 1)",
        },
      },
      4: {
        value: {
          _osLight: "hsl({colors.gray.3} / 1)",
          _osDark: "hsl({colors.gray.9} / 1)",
        },
      },
    },
    square: {
      dark: {
        background: {
          DEFAULT: {
            value: "hsl({colors.indigo.9} / 1)",
          },
          highlight: {
            value: "hsl({colors.indigo.7} / 1)",
          },
        },
      },
      light: {
        background: {
          DEFAULT: {
            value: "hsl({colors.stone.3} / 1)",
          },
          highlight: {
            value: "hsl({colors.stone.1} / 1)",
          },
        },
      },
    },
  },
});
