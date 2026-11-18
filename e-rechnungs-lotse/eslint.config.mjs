import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/next-env.d.ts",
      "packages/db/drizzle/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Regel d): LLM-SDKs dürfen nur im zentralen Modul packages/core/src/llm verwendet werden.
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: ["packages/core/src/llm/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "openai",
                "@anthropic-ai/*",
                "@mistralai/*",
                "@google/genai",
                "@aws-sdk/client-bedrock*",
                "@azure/openai",
                "ollama",
              ],
              message: "LLM-Aufrufe nur über packages/core/src/llm (siehe CLAUDE.md, Regel d).",
            },
          ],
        },
      ],
    },
  },
);
