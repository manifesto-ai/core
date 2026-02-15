import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { melPlugin } from "@manifesto-ai/compiler/vite";

export default defineConfig({
  plugins: [melPlugin(), react()],
});
