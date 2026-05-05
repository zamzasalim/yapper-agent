import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_URL:   process.env.NEXT_PUBLIC_APP_URL   ?? "https://yapperagent.xyz",
    NEXT_PUBLIC_AGENT_URL: process.env.NEXT_PUBLIC_AGENT_URL ?? "https://agent.yapperagent.xyz",
    NEXT_PUBLIC_DOCS_URL:  process.env.NEXT_PUBLIC_DOCS_URL  ?? "https://docs.yapperagent.xyz",
    NEXT_PUBLIC_API_URL:   process.env.NEXT_PUBLIC_API_URL   ?? "https://api.yapperagent.xyz",
    NEXT_PUBLIC_ADMIN_URL:  process.env.NEXT_PUBLIC_ADMIN_URL  ?? "https://admin.yapperagent.xyz",
    NEXT_PUBLIC_VAULT_ADDRESS: process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? "2kBsz4CvoqArhRefhy1XHC7STeygudFSWDfB1dDdDWbU",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "abs.twimg.com" },
    ],
  },
  async rewrites() {
    return [
      // docs.yapperagent.xyz → serves /docs page (URL stays as docs.yapperagent.xyz)
      {
        source: "/",
        has: [{ type: "host", value: "docs.yapperagent.xyz" }],
        destination: "/docs",
      },
    ];
  },
  // Bot runs as a separate process — exclude from Next.js build
  serverExternalPackages: ["grammy"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
