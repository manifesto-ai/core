import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync } from "fs";
import { compileMelDomain } from "@manifesto-ai/compiler";

// MEL file plugin - compiles .mel files to DomainSchema at build time
function melPlugin() {
  return {
    name: "vite-plugin-mel",
    enforce: "pre" as const,
    transform(_code: string, id: string) {
      if (id.endsWith(".mel")) {
        const content = readFileSync(id, "utf-8");

        // Compile MEL to schema at build time (runs in Node.js)
        const result = compileMelDomain(content, { mode: "domain" });

        if (result.errors.length > 0) {
          const errorMsg = result.errors.map(e => `[${e.code}] ${e.message}`).join("\n");
          throw new Error(`MEL compilation failed for ${id}:\n${errorMsg}`);
        }

        // Export the pre-compiled schema
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
    exclude: ["@manifesto-ai/compiler"], // Compiler runs at build time only
  },
  build: {
    rollupOptions: {
      // Don't bundle the compiler for production (it's used at build time only)
      external: ["@manifesto-ai/compiler"],
    },
  },
});
