import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createCompilerCodegen, createDomainPlugin } from "@manifesto-ai/codegen";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [
    melPlugin({
      codegen: {
        emit: createCompilerCodegen({
          plugins: [createDomainPlugin({ interfaceName: "TodoDomain" })],
        }),
        timing: "transform",
      },
    }),
    react(),
  ],
});
