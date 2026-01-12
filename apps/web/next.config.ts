import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // S3 정적 호스팅을 위한 Static Export 설정
  output: 'export',
  trailingSlash: true,

  transpilePackages: ['@mega-ticket/shared-types', '@mega-ticket/shared-utils'],
  typescript: {
    ignoreBuildErrors: true,
  },
  // Static Export에서는 Image Optimization 사용 불가
  images: {
    unoptimized: true,
  },
};
export default nextConfig;

