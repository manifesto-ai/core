import { defineConfig } from 'tsup'
import vue from 'esbuild-plugin-vue3'
import { copyFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/composables/index.ts',
  ],
  format: ['esm', 'cjs'],
  // Declarations are emitted via vue-tsc (build:types) because esbuild dts struggles with Vue SFCs
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: ['vue', '@manifesto-ai/schema', '@manifesto-ai/engine', '@manifesto-ai/ui'],
  esbuildPlugins: [vue()],
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    }
  },
  onSuccess: async () => {
    // Copy CSS to dist
    const srcCss = join(process.cwd(), 'src/styles/index.css')
    const distCss = join(process.cwd(), 'dist/index.css')
    try {
      mkdirSync(dirname(distCss), { recursive: true })
      copyFileSync(srcCss, distCss)
      console.log('CSS copied to dist/index.css')
    } catch (e) {
      console.warn('Could not copy CSS:', e)
    }
  },
})
