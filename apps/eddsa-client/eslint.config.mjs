import { config } from "@repo/eslint-config/base";

export default [
  ...config,
  {
    ignores: ["examples/**", "dist/**", "test-ledger/**", "jest.config.js"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];

