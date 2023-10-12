import { defineConfig, defineGlobalStyles } from "@pandacss/dev";

const globalCss = defineGlobalStyles({
  "body": {
    backgroundColor: "background"
  }
});

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx}"],

  // Files to exclude
  exclude: [],

  jsxFramework: "react",

  // Useful for theme customization
  theme: {
    extend: {
      tokens: {
        colors: {
          background: {
            value: "{colors.slate.950}"
          },
          lightSquare: {
            value: "{colors.blue.50}"
          },
          darkSquare: {
            value: "{colors.blue.900}"
          },
          primary: {
            value: "{colors.yellow.300}"
          }
        }
      }

    }
  },

  patterns: {
    extend: {
      board: {
        jsxName: "Board",
        transform() {
          return {
            aspectRatio: "square",
            backgroundColor: "slate.900",
            height: "100vh",
            columns: 8,
            rowGap: 0,
            columnGap: 0
          }
        }
      }
    }
  },


  // The output directory for your css system
  outdir: "styled-system",
  globalCss
})
