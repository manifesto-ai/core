import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  resolve: {
    alias: {
      "@manifesto-ai/runtime": path.resolve(__dirname, "../runtime/src"),
      "@manifesto-ai/sdk": path.resolve(__dirname, "../sdk/src"),
    },
  },
});
