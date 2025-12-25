/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@manifesto-ai/core',
    '@manifesto-ai/bridge',
    '@manifesto-ai/bridge-react-hook-form',
    '@manifesto-ai/projection-ui',
    '@manifesto-ai/projection-agent'
  ],
  // Mark @swc/core as external to prevent bundling issues
  serverExternalPackages: ['@swc/core', '@manifesto-ai/compiler'],
};

module.exports = nextConfig;
