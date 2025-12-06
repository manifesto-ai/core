import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/generators/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: ['@manifesto-ai/schema', '@ai-sdk/openai', '@ai-sdk/anthropic'],
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    }
  },
})
