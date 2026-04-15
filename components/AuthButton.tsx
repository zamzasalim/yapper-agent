"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { cn } from "@/lib/cn";

export function AuthButton() {
  const pathname = usePathname();
  const { ready, authenticated, login, user } = usePrivy();

  const twitterHandle = (user?.linkedAccounts ?? []).find(
    (a) => a.type === "twitter_oauth"
    // @ts-ignore
  )?.username ?? user?.twitter?.username;

  if (!ready) {
    return <div className="skeleton w-24 h-8 rounded-lg" />;
  }

  if (authenticated) {
    return (
      <Link
        href="/dashboard"
        className={cn(
          "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          pathname === "/dashboard"
            ? "bg-blue-50 text-blue-600"
            : "text-neutral-600 hover:bg-neutral-100"
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
    <button onClick={() => login()} className="btn-primary text-xs px-4 py-2">
      Connect X
    </button>
  );
}
