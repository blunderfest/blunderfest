import { defineConfig } from "@pandacss/dev";
import { reset, theme } from "./src/lib/theme/";

export default defineConfig({
    // Whether to use css reset
    preflight: false,
    presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],

    // Where to look for your css declarations
    include: ["./src/**/*.{ts,tsx}"],

    // Files to exclude
    exclude: [],

    // The output directory for your css system
    outdir: "src/lib/styled-system",
    jsxFramework: "react",
    watch: true,
    minify: true,
    strictPropertyValues: true,
    strictTokens: true,

    globalCss: reset,

    // Useful for theme customization
    theme: {
        extend: theme,
    },
});
