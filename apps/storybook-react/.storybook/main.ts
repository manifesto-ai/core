import type { StorybookConfig } from '@storybook/react-vite'
import { loadEnv } from 'vite'

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  refs: {
    vue: {
      title: 'Vue',
      url: process.env.NODE_ENV === 'production'
        ? '/vue'
        : 'http://localhost:6007',
    },
  },
  async viteFinal(config) {
    // Load env from monorepo root
    const env = loadEnv('', process.cwd() + '/../..', '')
    return {
      ...config,
      define: {
        ...config.define,
        'import.meta.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY || ''),
      },
    }
  },
}

export default config
