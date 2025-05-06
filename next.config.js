/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  distDir: 'dist',
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
};

module.exports = nextConfig;
