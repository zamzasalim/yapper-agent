import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_URL:   process.env.NEXT_PUBLIC_APP_URL   ?? "https://yapperagent.xyz",
    NEXT_PUBLIC_AGENT_URL: process.env.NEXT_PUBLIC_AGENT_URL ?? "https://agent.yapperagent.xyz",
    NEXT_PUBLIC_DOCS_URL:  process.env.NEXT_PUBLIC_DOCS_URL  ?? "https://docs.yapperagent.xyz",
    NEXT_PUBLIC_API_URL:   process.env.NEXT_PUBLIC_API_URL   ?? "https://api.yapperagent.xyz",
    NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL ?? "https://admin.yapperagent.xyz",
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
