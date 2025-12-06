import { defineConfig } from 'tsup'
import { copyFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  entry: ['src/index.ts', 'src/hooks/index.ts'],
  format: ['esm', 'cjs'],
  dts: {
    entry: ['src/index.ts', 'src/hooks/index.ts'],
  },
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', '@manifesto-ai/schema', '@manifesto-ai/engine', '@manifesto-ai/ui'],
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    }
  },
  onSuccess: async () => {
    // Copy CSS to dist
    const srcCss = join(process.cwd(), 'src/styles/index.css')
    const distDir = join(process.cwd(), 'dist/styles')
    const distCss = join(distDir, 'index.css')

    // Also copy to dist root for simpler import
    const distRootCss = join(process.cwd(), 'dist/index.css')

    try {
      mkdirSync(distDir, { recursive: true })
      copyFileSync(srcCss, distCss)
      copyFileSync(srcCss, distRootCss)
      console.log('CSS copied to dist/')
    } catch (e) {
      console.error('Failed to copy CSS:', e)
    }
  },
})
