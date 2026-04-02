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
        find: "@manifesto-ai/sdk",
        replacement: fromHere("../sdk/src/index.ts"),
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
    },
  },
});
