"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      })
  );

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

  if (!appId || appId.length < 10) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // ── Only X (Twitter) login ───────────────────────────────────────
        loginMethods: ["twitter"],

        appearance: {
          theme: "light",
          accentColor: "#0066ff",
          logo: "/logo.png",
          landingHeader: "Connect with X to continue",
          loginMessage: "Sign in with your verified X (Twitter) account to earn USDC.",
          showWalletLoginFirst: false,
        },

        // ── No embedded wallet — user adds Solana address manually ───────
        embeddedWallets: {
          solana: { createOnLogin: "off" },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PrivyProvider>
  );
}
