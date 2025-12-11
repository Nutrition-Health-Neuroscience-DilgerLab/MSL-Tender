import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-54fd27572f2e4efc843722bee98239e0.r2.dev',
        pathname: '/original/**',
      },
    ],
  },
};

export default nextConfig;
