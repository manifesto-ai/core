import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.{test,spec}.ts"],
    coverage: {
      all: true,
      provider: "v8",
      reporter: ["text-summary", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/__tests__/**",
      ],
      // Ratchet thresholds: ~2pts below measured 2026-06-12 baseline
      // (post test-expansion). Raise alongside coverage improvements;
      // never lower silently.
      thresholds: {
        lines: 84,
        branches: 75,
        functions: 85,
      },
    },
  },
});
