// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withTV } = require("tailwind-variants/dist/transformer");

/** @type {import('tailwindcss').Config} */
module.exports = withTV({
  darkMode: ["selector", '[data-mode="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
});
