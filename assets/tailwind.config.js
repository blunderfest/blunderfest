const { withTV } = require("tailwind-variants/transformer");

/** @type {import('tailwindcss').Config} */
export default withTV({
  content: ["./index.html", "../lib/blunderfest_web/**/*.html.heex", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
});
