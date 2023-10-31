import { defaultTheme } from "@/themes/defaultTheme";
import { defineConfig, defineGlobalStyles } from "@pandacss/dev";

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

  theme: defaultTheme,

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
