/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript errors during builds
    ignoreBuildErrors: true,
  },
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: undefined,
  },
}

module.exports = nextConfig

