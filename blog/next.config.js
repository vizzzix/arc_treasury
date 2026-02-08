/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  basePath: '/blog',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
