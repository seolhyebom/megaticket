import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'standalone',
    transpilePackages: ['@mega-ticket/shared-types', '@mega-ticket/shared-utils'],
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
};

export default nextConfig;
