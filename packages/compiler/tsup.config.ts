import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    vite: "src/vite.ts",
    webpack: "src/webpack.ts",
    rollup: "src/rollup.ts",
    esbuild: "src/esbuild.ts",
    rspack: "src/rspack.ts",
    "node-loader": "src/node-loader.ts",
  },
  format: "esm",
  tsconfig: "tsconfig.build.json",
  dts: false,
  clean: true,
  sourcemap: true,
});
