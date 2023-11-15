import { defineSemanticTokens } from "@pandacss/dev";

export const semanticTokens = defineSemanticTokens({
  borders: {
    square: {
      focussed: {
        value: "{borders.3} solid {colors.gray.10}",
      },
      light: {
        marked: {
          simple: {
            value: "{borders.3} solid {colors.red.8}",
          },
          ctrl: {
            value: "{borders.3} solid {colors.green.9}",
          },
          alt: {
            value: "{borders.3} solid {colors.yellow.5}",
          },
        },
      },
      dark: {
        marked: {
          simple: {
            value: "{borders.3} solid {colors.red.8}",
          },
          ctrl: {
            value: "{borders.3} solid {colors.green.7}",
          },
          alt: {
            value: "{borders.3} solid {colors.yellow.5}",
          },
        },
      },
    },
  },
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
    text: {
      1: {
        value: {
          _osLight: "{colors.gray.9}",
          _osDark: "{colors.gray.1}",
        },
      },
      2: {
        value: {
          _osLight: "{colors.gray.8}",
          _osDark: "{colors.gray.2}",
        },
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
            value: "{colors.indigo.9}",
          },
          highlighted: {
            value: "{colors.indigo.7}",
          },
          draggedOver: {
            value: "{colors.lime.1}",
          },
        },
      },
      light: {
        background: {
          DEFAULT: {
            value: "{colors.stone.3}",
          },
          highlighted: {
            value: "{colors.stone.1}",
          },
          draggedOver: {
            value: "{colors.lime.1}",
          },
        },
      },
    },
  },
});
