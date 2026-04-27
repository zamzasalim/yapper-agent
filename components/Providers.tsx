"use client";

import { createAppKit } from "@reown/appkit/react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import { solana, solanaDevnet } from "@reown/appkit/networks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

const solanaAdapter = new SolanaAdapter();

if (typeof window !== "undefined") {
  // Suppress Lit dev-mode warning from Reown's internal components
  (globalThis as Record<string, unknown>).litIssuedWarnings ??= new Set();
  ((globalThis as Record<string, unknown>).litIssuedWarnings as Set<string>).add("dev-mode");
}

if (projectId) {
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "https://yapperagent.xyz");

  const isDevnet = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet";

  createAppKit({
    adapters: [solanaAdapter],
    networks: isDevnet ? [solanaDevnet, solana] : [solana, solanaDevnet],
    projectId,
    features: { analytics: true },
    metadata: {
      name: "Yapper Agent",
      description: "Earn USDC with your X account",
      url: appUrl,
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
