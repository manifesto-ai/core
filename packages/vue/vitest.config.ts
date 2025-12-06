import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/__tests__/**/*.test.ts'],
    alias: {
      '@manifesto-ai/schema': path.resolve(__dirname, '../schema/src'),
      '@manifesto-ai/engine': path.resolve(__dirname, '../engine/src'),
      '@manifesto-ai/ui': path.resolve(__dirname, '../ui/src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/composables/useFormRuntime.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/index.ts',
        'src/**/*.d.ts',
        'src/types/**',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
})
