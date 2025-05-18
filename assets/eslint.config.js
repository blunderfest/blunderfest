import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import reactCompiler from "eslint-plugin-react-compiler";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import i18nJsonPlugin from "eslint-plugin-i18n-json";
import * as pluginImportX from "eslint-plugin-import-x";
import tsParser from "@typescript-eslint/parser";
import path from "path";
import perfectionist from "eslint-plugin-perfectionist";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    ...eslintPluginUnicorn.configs.recommended,
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      pluginImportX.flatConfigs.recommended,
      pluginImportX.flatConfigs.typescript,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tsParser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "react-compiler": reactCompiler,
      "unused-imports": unusedImports,
      unicorn: eslintPluginUnicorn,
      perfectionist,
    },
    rules: {
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
        },
      ],
      "max-params": ["error", 3], // Limit the number of parameters in a function to use object instead
      "max-lines-per-function": ["error", 70],
      "react/display-name": "off",
      "react/no-inline-styles": "off",
      "react/destructuring-assignment": "off", // Vscode doesn't support automatically destructuring, it's a pain to add a new variable
      "react/require-default-props": "off", // Allow non-defined react props as undefined
      "@typescript-eslint/comma-dangle": "off", // Avoid conflict rule between Eslint and Prettier
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
          disallowTypeAnnotations: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "perfectionist/sort-imports": "error",
    },
  },
  {
    ...i18nJsonPlugin.configs.recommended,
    files: ["src/translations/*.json"],
    plugins: { "i18n-json": i18nJsonPlugin },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.builtin,
    },
    processor: {
      meta: { name: ".json" },
      ...i18nJsonPlugin.processors[".json"],
    },
    rules: {
      "i18n-json/valid-message-syntax": [
        2,
        {
          syntax: path.resolve("./scripts/i18next-syntax-validation.cjs"),
        },
      ],
      "i18n-json/valid-json": 2,
      "i18n-json/sorted-keys": [
        2,
        {
          order: "asc",
          indentSpaces: 2,
        },
      ],
      "i18n-json/identical-keys": [
        2,
        {
          filePath: path.resolve("./src/translations/en.json"),
        },
      ],
    },
  },
);
