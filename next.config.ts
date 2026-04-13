import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "abs.twimg.com" },
    ],
  },
  // Bot runs as a separate process — exclude from Next.js build
  serverExternalPackages: ["grammy"],
};

export default nextConfig;
