import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@mega-ticket/shared-types', '@mega-ticket/shared-utils'],
  // rewrites()는 빌드 시점에 고정되므로 제거
  // /api/* 요청은 app/api/[...path]/route.ts에서 런타임 프록시로 처리
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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
