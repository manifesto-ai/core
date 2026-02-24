import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: [
      "packages/**/src/**/*.test.ts",
      "packages/compiler/__tests__/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      // Translator package not linked in compiler devDependencies
      "packages/compiler/src/__tests__/e2e-integration.test.ts",
      "packages/compiler/src/__tests__/saas-modeling.test.ts",
      "packages/compiler/__tests__/e2e/**/*.test.ts",
    ],
  },
});
