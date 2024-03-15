import { defineConfig } from "@pandacss/dev";

if (process.argv.includes("--watch")) {
  // Terminate the watcher when Phoenix quits

  process.stdin.on("close", () => {
    process.exit(0);
  });

  process.stdin.resume();
}

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["../../apps/blunderfest/src/**/*.{js,jsx}"],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {
      tokens: {
        colors: {
          primary: {
            value: "{colors.purple.300}",
          },
        },
      },
    },
  },

  // The output directory for your css system
  outdir: "styled-system",
  jsxFramework: "react",
});
