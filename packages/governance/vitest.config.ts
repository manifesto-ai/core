import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

function fromHere(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@manifesto-ai/sdk/provider",
        replacement: fromHere("../sdk/src/provider.ts"),
      },
      {
        find: "@manifesto-ai/sdk/extensions",
        replacement: fromHere("../sdk/src/extensions.ts"),
      },
      {
        find: "@manifesto-ai/sdk",
        replacement: fromHere("../sdk/src/index.ts"),
      },
      {
        find: "@manifesto-ai/lineage/provider",
        replacement: fromHere("../lineage/src/provider.ts"),
      },
      {
        find: "@manifesto-ai/lineage",
        replacement: fromHere("../lineage/src/index.ts"),
      },
      {
        find: "@manifesto-ai/cts-kit",
        replacement: fromHere("../../cts/cts-kit/src/index.ts"),
      },
    ],
  },
  test: {
    include: ["src/**/*.{test,spec}.ts"],
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
      ],
      // Ratchet thresholds: ~2pts below measured 2026-06-12 baseline.
      // Raise alongside coverage improvements; never lower silently.
      thresholds: {
        lines: 64,
        branches: 59,
        functions: 69,
      },
    },
  },
});
