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
        replacement: fromHere("../../packages/sdk/src/provider.ts"),
      },
      {
        find: "@manifesto-ai/sdk",
        replacement: fromHere("../../packages/sdk/src/index.ts"),
      },
      {
        find: "@manifesto-ai/lineage/provider",
        replacement: fromHere("../../packages/lineage/src/provider.ts"),
      },
      {
        find: "@manifesto-ai/lineage",
        replacement: fromHere("../../packages/lineage/src/index.ts"),
      },
      {
        find: "@manifesto-ai/governance/provider",
        replacement: fromHere("../../packages/governance/src/provider.ts"),
      },
      {
        find: "@manifesto-ai/governance",
        replacement: fromHere("../../packages/governance/src/index.ts"),
      },
    ],
  },
  test: {
    globals: true,
    include: ["src/**/*.spec.ts"],
    exclude: ["**/node_modules/**"],
  },
});
