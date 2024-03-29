import radixPreset, { type ColorRadixPresetOptions } from "@amandaguthrie/panda-preset-color-radix";
import { defineConfig } from "@pandacss/dev";
import { preset } from "./src/theme/preset";

const radixPresetConfig: ColorRadixPresetOptions = {
  colors: "*",
  colorModeConditions: { default: "dark", light: ["_light"], dark: ["_dark"] },
  semanticColorMap: { primary: { color: "grass", default: "dark" } },
};

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],
  exclude: [],
  optimize: false,

  presets: ["@park-ui/panda-preset", radixPreset(radixPresetConfig), preset],

  outdir: "styled-system",
  jsxFramework: "react",
});
