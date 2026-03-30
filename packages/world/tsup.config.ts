import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/in-memory.ts",
    "src/indexeddb.ts",
    "src/sqlite.ts",
  ],
  format: "esm",
  tsconfig: "tsconfig.build.json",
  dts: true,
  clean: true,
  sourcemap: true,
});
