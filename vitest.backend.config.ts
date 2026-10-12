import { defineConfig } from "vitest/config";

// Backend-Tests: Datenbank (lokales Postgres) und Edge-Function-Handler unter Node.
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/**/*.test.ts"],
    globalSetup: ["./supabase/tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
