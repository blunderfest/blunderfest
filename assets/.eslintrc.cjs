module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:react/jsx-runtime",
    "plugin:jsx-a11y/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  plugins: ["react", "react-refresh", "no-relative-import-paths"],
  rules: {
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    "react/display-name": "off",
    "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
    "react/jsx-no-leaked-render": "error",
    "react/jsx-curly-brace-presence": "error",
    "react/self-closing-comp": "error",
    "react/jsx-sort-props": "error",
    "no-relative-import-paths/no-relative-import-paths": ["error", { allowSameFolder: true }],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
