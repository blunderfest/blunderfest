const { withTV } = require("tailwind-variants/dist/transformer");

/** @type {import('tailwindcss').Config} */
export default withTV({
  darkMode: ["selector", '[data-mode="dark"]'],
  content: ["./src/**/*.{js,jsx}", "../lib/blunderfest_web/components/layouts/*.html.heex"],
});
