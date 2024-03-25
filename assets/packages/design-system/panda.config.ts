/* eslint-disable no-undef */
import radixPreset, { type ColorRadixPresetOptions } from "@amandaguthrie/panda-preset-color-radix";
import { defineConfig } from "@pandacss/dev";
import { preset } from "./theme/preset";

if (process.argv.includes("--watch")) {
  // Terminate the watcher when Phoenix quits

  process.stdin.on("close", () => {
    process.exit(0);
  });

  process.stdin.resume();
}

const radixPresetConfig: ColorRadixPresetOptions = {
  colors: "*",
  colorModeConditions: { default: "dark", light: ["_light"], dark: ["_dark"] },
  semanticColorMap: { primary: { color: "grass", default: "dark" } },
};

export default defineConfig({
  preflight: false,
  include: ["../../apps/blunderfest/src/**/*.{js,jsx}"],
  exclude: [],
  optimize: false,

  presets: [radixPreset(radixPresetConfig), preset],

  outdir: "styled-system",
  jsxFramework: "react",
});
