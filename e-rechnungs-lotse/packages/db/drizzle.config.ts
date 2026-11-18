import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://erl:erl@localhost:5432/erl",
  },
  strict: true,
});
