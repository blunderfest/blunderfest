import { defineConfig } from "@pandacss/dev";
import { reset, theme } from "./src/lib/theme/";

export default defineConfig({
    // Whether to use css reset
    preflight: false,
    presets: ["@pandacss/preset-base"],

    // Where to look for your css declarations
    include: ["./src/**/*.{ts,tsx}"],

    // Files to exclude
    exclude: [],

    jsxFramework: "react",
    // The output directory for your css system
    outdir: "src/lib/styled-system",
    watch: true,
    strictPropertyValues: true,
    strictTokens: true,

    globalCss: reset,

    // Useful for theme customization
    theme: theme,
    conditions: {
        extend: {
            dark: '[data-color-scheme="dark"] &',
            light: '[data-color-scheme="light"] &',
        },
    },
});
