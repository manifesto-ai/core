import { defineConfig } from "tsup";

const release = process.env.MANIFESTO_RELEASE === "1";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  tsconfig: "tsconfig.build.json",
  dts: false,
  clean: true,
  sourcemap: !release,
});
