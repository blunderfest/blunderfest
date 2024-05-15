const { withTV } = require("tailwind-variants/dist/transformer");
const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ["selector", '[data-mode="dark"]'],
  content: ["./src/**/*.{ts,tsx}", "../lib/blunderfest_web/controllers/room_html.ex"],
  theme: {
    extend: {
      colors: {
        surface: colors.neutral,
      },
    },
  },
};

export default withTV(config);
