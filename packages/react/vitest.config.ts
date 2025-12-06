import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    alias: {
      '@manifesto-ai/schema': path.resolve(__dirname, '../schema/src'),
      '@manifesto-ai/engine': path.resolve(__dirname, '../engine/src'),
      '@manifesto-ai/ui': path.resolve(__dirname, '../ui/src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/hooks/useFormRuntime.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/index.ts',
        'src/**/*.d.ts',
        'src/types/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
})
