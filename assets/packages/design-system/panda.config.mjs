/* eslint-disable no-undef */
import { defineConfig } from "@pandacss/dev";
import { preset } from "./theme/preset";

if (process.argv.includes("--watch")) {
  // Terminate the watcher when Phoenix quits

  process.stdin.on("close", () => {
    process.exit(0);
  });

  process.stdin.resume();
}

export default defineConfig({
  preflight: false,
  include: ["../../apps/blunderfest/src/**/*.{js,jsx}"],
  exclude: [],
  optimize: false,

  presets: [preset],

  outdir: "styled-system",
  jsxFramework: "react",
});
