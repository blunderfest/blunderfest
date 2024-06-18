const { withTV } = require("tailwind-variants/transformer");

/** @type {import('tailwindcss').Config} */
export default withTV({
  content: ["./index.html", "../lib/blunderfest_web/**/*.html.heex", "./src/**/*.{js,jsx}"],
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
