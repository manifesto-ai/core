import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync } from "fs";
import { compileMelDomain } from "@manifesto-ai/compiler";

function melPlugin() {
  return {
    name: "vite-plugin-mel",
    enforce: "pre" as const,
    transform(_code: string, id: string) {
      if (id.endsWith(".mel")) {
        const content = readFileSync(id, "utf-8");
        const result = compileMelDomain(content, { mode: "domain" });

        if (result.errors.length > 0) {
          const errorMsg = result.errors.map(e => `[${e.code}] ${e.message}`).join("\n");
          throw new Error(`MEL compilation failed for ${id}:\n${errorMsg}`);
        }

        return {
          code: `export default ${JSON.stringify(result.schema)};`,
          map: null,
        };
      }
    },
  };
}

export default defineConfig({
  plugins: [melPlugin(), react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
    exclude: ["@manifesto-ai/compiler"],
  },
  build: {
    rollupOptions: {
      external: ["@manifesto-ai/compiler"],
    },
  },
});
