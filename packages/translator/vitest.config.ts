import { defineConfig } from "vitest/config";
import { readFileSync } from "fs";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  assetsInclude: ["**/*.mel"],
  plugins: [
    {
      name: "mel-loader",
      enforce: "pre" as const,
      transform(_code, id) {
        if (id.endsWith(".mel")) {
          // Read the actual file content
          const content = readFileSync(id, "utf-8");
          return {
            code: `export default ${JSON.stringify(content)};`,
            map: null,
          };
        }
      },
    },
  ],
});
