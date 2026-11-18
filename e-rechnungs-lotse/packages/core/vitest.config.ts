import { defineConfig } from "vitest/config";

/**
 * Zwei Projekte:
 * - unit:        schnell, ohne Netzwerk (Validator wird gemockt bzw. aufgezeichnete Berichte)
 * - integration: gegen den laufenden Validator-Container (VALIDATOR_URL, Standard http://localhost:8081)
 */
export default defineConfig({
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["test/**/*.test.ts"], exclude: ["test/integration/**"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["test/integration/**/*.int.test.ts"],
          testTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Einstiegspunkt ohne Logik (wird per CLI-Rauchtest in CI geprüft).
      exclude: ["src/cli.ts"],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
