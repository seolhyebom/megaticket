import type { NextConfig } from "next";

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:3001';

const nextConfig: NextConfig = {
  transpilePackages: ['@mega-ticket/shared-types', '@mega-ticket/shared-utils'],
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL || 'http://localhost:3001';
    console.log(`[Rewrites] INTERNAL_API_URL: ${apiUrl}`);

    return [
      {
        source: '/api/backend/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // [V8.0] eslint 설정은 Next.js 15에서 별도 eslint.config.mjs로 분리됨
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};
export default nextConfig;

