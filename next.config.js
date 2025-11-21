/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable static optimization for API routes that need runtime config
  serverRuntimeConfig: {
    // Add any server-only runtime config here
  },
};

module.exports = nextConfig;

