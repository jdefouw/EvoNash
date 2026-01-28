/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for self-hosted deployment
  output: 'standalone',
  reactStrictMode: true,
  
  // Custom headers (replaces vercel.json headers)
  async headers() {
    return [
      {
        source: '/api/dashboard',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, max-age=0, must-revalidate'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
