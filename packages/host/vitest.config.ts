import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

function fromHere(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@manifesto-ai/cts-kit",
        replacement: fromHere("../../cts/cts-kit/src/index.ts"),
      },
    ],
  },
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
        branches: 70,
        functions: 79,
      },
    },
  },
});
