import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.{test,spec}.ts"],
    coverage: {
      all: true,
      provider: "v8",
      reporter: ["text-summary", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/__tests__/**",
      ],
      // Ratchet thresholds: ~2pts below measured 2026-06-12 baseline.
      // Raise alongside coverage improvements; never lower silently.
      thresholds: {
        lines: 64,
        branches: 54,
        functions: 70,
      },
    },
  },
});
