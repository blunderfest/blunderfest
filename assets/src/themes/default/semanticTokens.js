import { defineSemanticTokens } from "@pandacss/dev";

export const semanticTokens = defineSemanticTokens({
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
          highlight: {
            value: "{colors.indigo.1}",
          },
        },
      },
      light: {
        background: {
          DEFAULT: {
            value: "{colors.stone.2}",
          },
          highlight: {
            value: "{colors.stone.10}",
          },
        },
      },
    },
  },
});
