import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_AGENT_URL: process.env.NEXT_PUBLIC_AGENT_URL ?? "https://agent.yapper-agent-five.vercel.app",
    NEXT_PUBLIC_DOCS_URL:  process.env.NEXT_PUBLIC_DOCS_URL  ?? "https://docs.yapper-agent-five.vercel.app",
  },
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
