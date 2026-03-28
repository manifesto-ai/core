import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/facade.ts"],
  format: "esm",
  tsconfig: "tsconfig.build.json",
  dts: true,
  clean: true,
  sourcemap: true,
});
