import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node, // <-- Use Node.js globals here
    },
    plugins: { js },
    extends: ["js/recommended"],
    env: {
      node: true, // enable Node.js environment
    },
  },

  {
    files: ["frontend/**/*.js"], // adjust path to your frontend files if any
    languageOptions: {
      globals: globals.browser, // browser globals only for frontend files
    },
    env: {
      browser: true,
    },
  },
]);
