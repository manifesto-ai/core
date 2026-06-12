import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    coverage: {
      all: true,
      provider: "v8",
      reporter: ["text-summary", "lcov", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/__tests__/**",
        "src/cli/**",
      ],
      // Ratchet thresholds: ~2pts below measured 2026-06-12 baseline.
      // Raise alongside coverage improvements; never lower silently.
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 70,
        functions: 79,
      },
    },
  },
});
