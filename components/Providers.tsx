"use client";

import { createAppKit } from "@reown/appkit/react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import { solana } from "@reown/appkit/networks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

const solanaAdapter = new SolanaAdapter();

if (projectId) {
  createAppKit({
    adapters: [solanaAdapter],
    networks: [solana],
    projectId,
    features: { analytics: true },
    metadata: {
      name: "Yapper Agent",
      description: "Earn USDC with your X account",
      url: process.env.NEXT_PUBLIC_APP_URL ?? "https://yapper-agent.vercel.app",
      icons: ["/logo.png"],
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
