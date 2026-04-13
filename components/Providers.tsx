"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      })
  );

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

  // Only init Privy when a real app ID is present
  if (!appId || appId.length < 10) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["twitter", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#0066ff",
          logo: "/logo.png",
          landingHeader: "Connect to Yapper Agent",
          loginMessage: "Sign in with your verified X account to start earning USDC.",
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PrivyProvider>
  );
}
