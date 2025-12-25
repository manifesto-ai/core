/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@manifesto-ai/core',
    '@manifesto-ai/compiler',
  ],
  serverExternalPackages: ['@swc/core'],
};

module.exports = nextConfig;
