import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Increase test timeout for complex integration tests
    testTimeout: 30000,
    // Run tests sequentially to reduce memory pressure
    sequence: {
      concurrent: false,
    },
    // Disable coverage to reduce memory usage
    coverage: {
      enabled: false,
    },
  },
});
