import fs from 'node:fs';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'mel-raw',
      enforce: 'pre',
      load(id) {
        if (id.endsWith('.mel')) {
          return `export default ${JSON.stringify(fs.readFileSync(id, 'utf8'))};`;
        }
        return null;
      },
    },
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
