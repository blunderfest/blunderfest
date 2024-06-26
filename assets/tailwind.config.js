const { withTV } = require("tailwind-variants/transformer");

/** @type {import('tailwindcss').Config} */
export default withTV({
  darkMode: ["class"],
  content: ["./index.html", "../lib/blunderfest_web/**/*.html.heex", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        text: "hsl(var(--text))",
        background: "hsl(var(--background))",
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        accent: "hsl(var(--accent))",
      },
    },
  },
  plugins: [],
});
