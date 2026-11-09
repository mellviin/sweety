import security from "eslint-plugin-security";

export default [
  {
    ignores: ["node_modules/**"],
  },
  {
    files: ["**/*.js"],
    plugins: {
      security,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      ...security.configs.recommended.rules,
    },
  },
];
