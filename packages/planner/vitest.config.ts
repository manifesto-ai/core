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
        find: "@manifesto-ai/lineage/provider",
        replacement: fromHere("../lineage/src/provider.ts"),
      },
      {
        find: "@manifesto-ai/core",
        replacement: fromHere("../core/src/index.ts"),
      },
      {
        find: "@manifesto-ai/sdk",
        replacement: fromHere("../sdk/src/index.ts"),
      },
      {
        find: "@manifesto-ai/governance",
        replacement: fromHere("../governance/src/index.ts"),
      },
      {
        find: "@manifesto-ai/lineage",
        replacement: fromHere("../lineage/src/index.ts"),
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
        "**/__tests__/**"
      ]
    }
  }
});
