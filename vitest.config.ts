import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: [
      "packages/**/src/**/*.{test,spec}.ts",
      "packages/compiler/__tests__/**/*.{test,spec}.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "packages/compiler/src/__tests__/e2e-integration.test.ts",
      "packages/compiler/src/__tests__/saas-modeling.test.ts",
    ],
  },
});
