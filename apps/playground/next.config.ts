import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@manifesto-ai/schema',
    '@manifesto-ai/engine',
    '@manifesto-ai/react',
    '@manifesto-ai/example-schemas',
  ],
}

export default nextConfig
