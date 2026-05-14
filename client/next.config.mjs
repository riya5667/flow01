/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

const nextConfig = {
  rewrites: async () => {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      }
    ];
  }
};

export default nextConfig;
