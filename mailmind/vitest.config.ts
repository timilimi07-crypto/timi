import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // server-only wirft außerhalb von React Server Components – in Tests neutralisieren.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
