import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
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
    },
  },
});
