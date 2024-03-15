import { defineConfig } from "@pandacss/dev";
import { reset, theme } from "./theme/";

if (process.argv.includes("--watch")) {
  // Terminate the watcher when Phoenix quits

  process.stdin.on("close", () => {
    process.exit(0);
  });

  process.stdin.resume();
}

export default defineConfig({
  preflight: false,
  include: ["/workspace/blunderfest/assets/apps/blunderfest/src/**/*.{js,jsx}"],
  exclude: [],
  globalCss: reset,
  optimize: false,
  logLevel: "debug",

  theme: theme,
  conditions: {
    extend: {
      dark: '[data-color-scheme="dark"] &',
      light: '[data-color-scheme="light"] &',
    },
  },

  outdir: "styled-system",
  jsxFramework: "react",
});
