const { withTV } = require("tailwind-variants/dist/transformer");

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ["selector", '[data-mode="dark"]'],
  content: ["./src/**/*.{ts,tsx}", "../lib/blunderfest_web/components/layouts/*.html.heex"],
  theme: {
    extend: {
      textColor: {
        surface: {
          1: "rgb(var(--color-neutral-900) / <alpha-value>)",
          2: "rgb(var(--color-neutral-800) / <alpha-value>)",
          3: "rgb(var(--color-neutral-700) / <alpha-value>)",
          4: "rgb(var(--color-neutral-600) / <alpha-value>)",
          5: "rgb(var(--color-neutral-500) / <alpha-value>)",
          6: "rgb(var(--color-neutral-400) / <alpha-value>)",
        },
      },
      backgroundColor: {
        surface: {
          1: "rgb(var(--color-neutral-50) / <alpha-value>)",
          2: "rgb(var(--color-neutral-100) / <alpha-value>)",
          3: "rgb(var(--color-neutral-200) / <alpha-value>)",
          4: "rgb(var(--color-neutral-300) / <alpha-value>)",
          5: "rgb(var(--color-neutral-400) / <alpha-value>)",
          6: "rgb(var(--color-neutral-500) / <alpha-value>)",
        },
      },
    },
  },
};

export default withTV(config);
