"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";

export function AuthButton() {
  const pathname = usePathname();
  const { open } = useAppKit();
  const { isConnected, embeddedWalletInfo, status } = useAppKitAccount();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const twitterHandle = embeddedWalletInfo?.user?.username ?? null;
  const isRestoring   = status === "connecting" || status === "reconnecting";

  if (!mounted || isRestoring) {
    return <div className="hidden sm:block w-24 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />;
  }

  if (isConnected) {
    return (
      <Link
        href="/dashboard"
        className={cn(
          "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          pathname === "/dashboard"
            ? "bg-blue-50 dark:bg-blue-950 text-blue-600"
            : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
        )}
      >
        {twitterHandle ? (
          <>
            <span className="text-blue-500">@</span>
            {twitterHandle}
          </>
        ) : (
          "Dashboard"
        )}
      </Link>
    );
  }

  return (
    <button onClick={() => open()} className="btn-primary text-xs px-4 py-2">
      Connect X
    </button>
  );
}
